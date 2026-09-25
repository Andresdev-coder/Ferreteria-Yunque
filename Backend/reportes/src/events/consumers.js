const { pool } = require('../db');
const { subscribe } = require('../rabbit');

// Mantiene la copia local de productos (para conocer su categoría)
async function onProducto(event) {
  const p = event.data;
  await pool.query(
    `INSERT INTO productos_cache (id, nombre, categoria)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), categoria = VALUES(categoria)`,
    [p.id, p.nombre, p.categoria ?? 'General']
  );
}

// Suma una venta a las dos vistas de lectura (por producto y por día).
// Se usa tanto al llegar el evento en vivo como al recalcular desde cero.
async function registrarVenta(conn, { items, total, fecha }) {
  for (const it of items) {
    const [[prod]] = await conn.query('SELECT categoria FROM productos_cache WHERE id = ?', [it.idProducto]);
    await conn.query(
      `INSERT INTO producto_ventas (id_producto, nombre, categoria, unidades_vendidas, total_vendido)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         nombre = VALUES(nombre),
         categoria = VALUES(categoria),
         unidades_vendidas = unidades_vendidas + VALUES(unidades_vendidas),
         total_vendido = total_vendido + VALUES(total_vendido)`,
      [it.idProducto, it.nombre, prod?.categoria ?? 'General', it.cantidad, it.subtotal]
    );
  }

  const dia = fecha.slice(0, 10); // AAAA-MM-DD
  await conn.query(
    `INSERT INTO ventas_resumen_diario (fecha, total_ventas, cantidad_ventas)
     VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE
       total_ventas = total_ventas + VALUES(total_ventas),
       cantidad_ventas = cantidad_ventas + 1`,
    [dia, total]
  );
}

async function onVentaConfirmada(event) {
  const v = event.data;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [ins] = await conn.query('INSERT IGNORE INTO eventos_procesados (event_id) VALUES (?)', [event.eventId]);
    if (ins.affectedRows === 0) {
      await conn.rollback();
      console.log('Evento duplicado, se ignora');
      return;
    }

    await registrarVenta(conn, { items: v.items, total: v.total, fecha: v.fecha });
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function registrarConsumidores() {
  await subscribe('reportes.productos', 'producto.*', onProducto);
  await subscribe('reportes.venta_confirmada', 'venta.confirmada', onVentaConfirmada);
}

module.exports = { registrarConsumidores, registrarVenta };
