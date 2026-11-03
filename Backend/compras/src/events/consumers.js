const { pool } = require('../db');
const { subscribe, publish } = require('../rabbit');

// Mantiene la copia local de productos (creados y actualizados)
async function onProducto(event) {
  const p = event.data;
  await pool.query(
    `INSERT INTO productos_cache (id, codigo, nombre, activo)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       codigo = VALUES(codigo), nombre = VALUES(nombre), activo = VALUES(activo)`,
    [p.id, p.codigo, p.nombre, p.activo ?? 1]
  );
}

// Un producto bajó del mínimo: se deja una sugerencia de compra
async function onStockBajoMinimo(event) {
  const d = event.data;
  const conn = await pool.getConnection();
  let idPedido = null;
  let cantidad = 0;

  try {
    await conn.beginTransaction();

    // 1. Idempotencia
    const [ins] = await conn.query(
      'INSERT IGNORE INTO eventos_procesados (event_id) VALUES (?)',
      [event.eventId]
    );
    if (ins.affectedRows === 0) {
      await conn.rollback();
      console.log('Evento duplicado, se ignora');
      return;
    }

    // 2. Si ya hay un pedido abierto para este producto, no se crea otro.
    //    (Inventario avisa en cada venta mientras el stock siga bajo.)
    const [abiertos] = await conn.query(
      `SELECT p.id FROM pedidos p
       JOIN pedido_items i ON i.id_pedido = p.id
       WHERE i.id_producto = ? AND p.estado IN ('SUGERIDO','CREADO','ENVIADO')
       LIMIT 1`,
      [d.idProducto]
    );
    if (abiertos.length) {
      await conn.commit();
      console.log(`Ya hay un pedido abierto para ${d.nombre}, no se crea otra sugerencia`);
      return;
    }

    // 3. Sugerencia: reponer hasta 3 veces el mínimo
    cantidad = Math.max(d.stockMinimo * 3 - d.stockActual, 1);
    const [r] = await conn.query(
      "INSERT INTO pedidos (estado, origen) VALUES ('SUGERIDO', 'AUTOMATICO') RETURNING id"
    );
    idPedido = r.insertId;
    await conn.query(
      'INSERT INTO pedido_items (id_pedido, id_producto, nombre, cantidad) VALUES (?,?,?,?)',
      [idPedido, d.idProducto, d.nombre, cantidad]
    );

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  if (idPedido) {
    publish('pedido.sugerido', 'PedidoSugerido', {
      idPedido,
      idProducto: d.idProducto,
      nombre: d.nombre,
      cantidadSugerida: cantidad,
    });
  }
}

async function registrarConsumidores() {
  await subscribe('compras.productos', 'producto.*', onProducto);
  await subscribe('compras.stock_bajo', 'stock.bajo_minimo', onStockBajoMinimo);
}

module.exports = { registrarConsumidores };
