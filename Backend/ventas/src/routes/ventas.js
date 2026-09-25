const express = require('express');
const { z } = require('zod');
const { pool } = require('../db');
const { publish } = require('../rabbit');

const router = express.Router();
const round2 = (n) => Math.round(n * 100) / 100;

const ventaSchema = z.object({
  cliente: z.string().optional(),
  vendedor: z.string().min(1),
  items: z
    .array(z.object({ idProducto: z.number().int().positive(), cantidad: z.number().int().positive() }))
    .min(1),
});

router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM ventas ORDER BY id DESC LIMIT 100');
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const [[venta]] = await pool.query('SELECT * FROM ventas WHERE id = ?', [req.params.id]);
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });
  const [items] = await pool.query('SELECT * FROM venta_items WHERE id_venta = ?', [venta.id]);
  res.json({ ...venta, items });
});

router.post('/', async (req, res) => {
  const parsed = ventaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { cliente, vendedor, items } = parsed.data;

  // Si un producto viene repetido, se suman las cantidades
  const cantidades = new Map();
  for (const it of items) {
    cantidades.set(it.idProducto, (cantidades.get(it.idProducto) || 0) + it.cantidad);
  }

  const [prods] = await pool.query('SELECT * FROM productos_cache WHERE id IN (?)', [[...cantidades.keys()]]);

  // El precio sale de nuestra copia local, nunca del cliente
  const detalle = [];
  const errores = [];
  for (const [id, cantidad] of cantidades) {
    const p = prods.find((x) => x.id === id);
    if (!p || !p.activo) { errores.push(`Producto ${id} no disponible`); continue; }
    if (p.stock < cantidad) {
      errores.push(`Stock insuficiente de ${p.nombre} (disponible: ${p.stock})`);
      continue;
    }
    const precioUnitario = Number(p.precio);
    detalle.push({ idProducto: id, nombre: p.nombre, cantidad, precioUnitario, subtotal: round2(precioUnitario * cantidad) });
  }
  if (errores.length) return res.status(409).json({ errores });

  const subtotal = round2(detalle.reduce((s, d) => s + d.subtotal, 0));
  const impuesto = round2((subtotal * Number(process.env.IMPUESTO_PORC || 0)) / 100);
  const total = round2(subtotal + impuesto);

  const conn = await pool.getConnection();
  let idVenta;
  try {
    await conn.beginTransaction();
    const [r] = await conn.query(
      'INSERT INTO ventas (cliente, vendedor, subtotal, impuesto, total) VALUES (?,?,?,?,?)',
      [cliente || null, vendedor, subtotal, impuesto, total]
    );
    idVenta = r.insertId;
    for (const d of detalle) {
      await conn.query(
        `INSERT INTO venta_items (id_venta, id_producto, nombre, cantidad, precio_unitario, subtotal)
         VALUES (?,?,?,?,?,?)`,
        [idVenta, d.idProducto, d.nombre, d.cantidad, d.precioUnitario, d.subtotal]
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  const venta = { idVenta, cliente: cliente || null, vendedor, items: detalle, subtotal, impuesto, total, fecha: new Date().toISOString() };
  publish('venta.confirmada', 'VentaConfirmada', venta);
  res.status(201).json(venta);
});

module.exports = router;