const { pool } = require('../db');
const { subscribe, publish } = require('../rabbit');

const SERIE = 'FY';

async function onVentaConfirmada(event) {
  const v = event.data;
  const conn = await pool.getConnection();
  let idFactura, numero;

  try {
    await conn.beginTransaction();

    // 1. Idempotencia: ¿ya procesé este evento?
    const [ins] = await conn.query(
      'INSERT IGNORE INTO eventos_procesados (event_id) VALUES (?)',
      [event.eventId]
    );
    if (ins.affectedRows === 0) {
      await conn.rollback();
      console.log('Evento duplicado, se ignora');
      return;
    }

    // 2. Una venta solo puede tener una factura
    const [dup] = await conn.query('SELECT id FROM facturas WHERE id_venta = ?', [v.idVenta]);
    if (dup.length) {
      await conn.rollback();
      console.log(`La venta ${v.idVenta} ya tiene factura, se ignora`);
      return;
    }

    // 3. Número consecutivo: la fila queda bloqueada hasta el commit,
    //    así dos facturas simultáneas nunca reciben el mismo número
    await conn.query('UPDATE numeracion SET ultimo = ultimo + 1 WHERE serie = ?', [SERIE]);
    const [[{ n }]] = await conn.query('SELECT ultimo AS n FROM numeracion WHERE serie = ?', [SERIE]);
    numero = `${SERIE}-${String(n).padStart(6, '0')}`;

    // 4. Guardar factura e ítems
    const [r] = await conn.query(
      `INSERT INTO facturas (numero, id_venta, cliente, vendedor, subtotal, impuesto, total)
       VALUES (?,?,?,?,?,?,?) RETURNING id`,
      [numero, v.idVenta, v.cliente, v.vendedor, v.subtotal, v.impuesto, v.total]
    );
    idFactura = r.insertId;

    for (const it of v.items) {
      await conn.query(
        `INSERT INTO factura_items (id_factura, id_producto, nombre, cantidad, precio_unitario, subtotal)
         VALUES (?,?,?,?,?,?)`,
        [idFactura, it.idProducto, it.nombre, it.cantidad, it.precioUnitario, it.subtotal]
      );
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  publish('factura.generada', 'FacturaGenerada', {
    idFactura,
    idVenta: v.idVenta,
    numero,
    total: v.total,
  });
}

async function registrarConsumidores() {
  await subscribe('facturacion.venta_confirmada', 'venta.confirmada', onVentaConfirmada);
}

module.exports = { registrarConsumidores };
