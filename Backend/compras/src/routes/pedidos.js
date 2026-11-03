const express = require('express');
const { z } = require('zod');
const { pool } = require('../db');
const { publish } = require('../rabbit');

const router = express.Router();

const itemSchema = z.object({
  idProducto: z.number().int().positive(),
  cantidad: z.number().int().positive(),
});
const crearSchema = z.object({ idProveedor: z.number().int().positive(), items: z.array(itemSchema).min(1) });
const confirmarSchema = z.object({ idProveedor: z.number().int().positive(), items: z.array(itemSchema).optional() });
const recibirSchema = z.object({ recibidoPor: z.string().trim().min(1) });

const ESTADO_INVALIDO = { error: 'El pedido no existe o su estado actual no permite esta acción.' };

async function cargarPedido(id) {
  const [[pedido]] = await pool.query(
    `SELECT p.*, pr.nombre AS proveedor
     FROM pedidos p LEFT JOIN proveedores pr ON pr.id = p.id_proveedor
     WHERE p.id = ?`,
    [id]
  );
  if (!pedido) return null;
  const [items] = await pool.query('SELECT * FROM pedido_items WHERE id_pedido = ?', [id]);
  return { ...pedido, items };
}

function publicarCreado(p) {
  publish('pedido.creado', 'PedidoProveedorCreado', {
    idPedido: p.id,
    idProveedor: p.id_proveedor,
    proveedor: p.proveedor,
    items: p.items.map((i) => ({ idProducto: i.id_producto, nombre: i.nombre, cantidad: i.cantidad })),
  });
}

router.get('/', async (req, res) => {
  const [pedidos] = await pool.query(
    `SELECT p.*, pr.nombre AS proveedor
     FROM pedidos p LEFT JOIN proveedores pr ON pr.id = p.id_proveedor
     ORDER BY p.id DESC LIMIT 100`
  );
  if (!pedidos.length) return res.json([]);
  const [items] = await pool.query('SELECT * FROM pedido_items WHERE id_pedido IN (?)', [pedidos.map((p) => p.id)]);
  res.json(pedidos.map((p) => ({ ...p, items: items.filter((i) => i.id_pedido === p.id) })));
});

router.get('/:id', async (req, res) => {
  const pedido = await cargarPedido(req.params.id);
  if (!pedido) return res.status(404).json({ error: 'Pedido no encontrado' });
  res.json(pedido);
});

// Pedido manual (sin pasar por una sugerencia)
router.post('/', async (req, res) => {
  const parsed = crearSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const { idProveedor, items } = parsed.data;

  const [[prov]] = await pool.query('SELECT id FROM proveedores WHERE id = ? AND activo = 1', [idProveedor]);
  if (!prov) return res.status(404).json({ error: 'Proveedor no encontrado' });

  const [prods] = await pool.query('SELECT id, nombre FROM productos_cache WHERE id IN (?) AND activo = 1', [
    items.map((i) => i.idProducto),
  ]);
  const faltan = items.filter((i) => !prods.find((p) => p.id === i.idProducto));
  if (faltan.length) {
    return res.status(409).json({ error: `Productos no disponibles: ${faltan.map((f) => f.idProducto).join(', ')}` });
  }

  const conn = await pool.getConnection();
  let idPedido;
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      "INSERT INTO pedidos (id_proveedor, estado, origen) VALUES (?, 'CREADO', 'MANUAL') RETURNING id",
      [idProveedor]
    );
    idPedido = r.insertId;
    for (const it of items) {
      const p = prods.find((x) => x.id === it.idProducto);
      await conn.query(
        'INSERT INTO pedido_items (id_pedido, id_producto, nombre, cantidad) VALUES (?,?,?,?)',
        [idPedido, it.idProducto, p.nombre, it.cantidad]
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  const pedido = await cargarPedido(idPedido);
  publicarCreado(pedido);
  res.status(201).json(pedido);
});

// SUGERIDO -> CREADO: se elige proveedor y, si se quiere, se ajusta la cantidad
router.post('/:id/confirmar', async (req, res) => {
  const parsed = confirmarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Elige un proveedor para confirmar el pedido.' });
  const { idProveedor, items } = parsed.data;

  const [[prov]] = await pool.query('SELECT id FROM proveedores WHERE id = ? AND activo = 1', [idProveedor]);
  if (!prov) return res.status(404).json({ error: 'Proveedor no encontrado' });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      "UPDATE pedidos SET estado = 'CREADO', id_proveedor = ? WHERE id = ? AND estado = 'SUGERIDO'",
      [idProveedor, req.params.id]
    );
    if (r.affectedRows === 0) {
      await conn.rollback();
      return res.status(409).json(ESTADO_INVALIDO);
    }
    for (const it of items || []) {
      await conn.query(
        'UPDATE pedido_items SET cantidad = ? WHERE id_pedido = ? AND id_producto = ?',
        [it.cantidad, req.params.id, it.idProducto]
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  const pedido = await cargarPedido(req.params.id);
  publicarCreado(pedido);
  res.json(pedido);
});

// CREADO -> ENVIADO
router.post('/:id/enviar', async (req, res) => {
  const [r] = await pool.query(
    "UPDATE pedidos SET estado = 'ENVIADO', enviado_en = NOW() WHERE id = ? AND estado = 'CREADO'",
    [req.params.id]
  );
  if (!r.affectedRows) return res.status(409).json(ESTADO_INVALIDO);
  res.json(await cargarPedido(req.params.id));
});

// ENVIADO -> RECIBIDO: publica MercanciaRecibida y Inventario repone el stock
router.post('/:id/recibir', async (req, res) => {
  const parsed = recibirSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Indica quién recibe la mercancía.' });

  const [r] = await pool.query(
    "UPDATE pedidos SET estado = 'RECIBIDO', recibido_por = ?, recibido_en = NOW() WHERE id = ? AND estado = 'ENVIADO'",
    [parsed.data.recibidoPor, req.params.id]
  );
  if (!r.affectedRows) return res.status(409).json(ESTADO_INVALIDO);

  const pedido = await cargarPedido(req.params.id);
  publish('mercancia.recibida', 'MercanciaRecibida', {
    idPedido: pedido.id,
    items: pedido.items.map((i) => ({ idProducto: i.id_producto, cantidad: i.cantidad })),
    recibidoPor: parsed.data.recibidoPor,
  });
  res.json(pedido);
});

router.post('/:id/cancelar', async (req, res) => {
  const [r] = await pool.query(
    "UPDATE pedidos SET estado = 'CANCELADO' WHERE id = ? AND estado IN ('SUGERIDO','CREADO','ENVIADO')",
    [req.params.id]
  );
  if (!r.affectedRows) return res.status(409).json(ESTADO_INVALIDO);
  res.json(await cargarPedido(req.params.id));
});

module.exports = router;
