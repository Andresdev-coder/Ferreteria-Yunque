const { pool } = require("../db");
const { subscribe, publish } = require("../rabbit");

class StockInsuficienteError extends Error {
  constructor(idProducto) {
    super("Stock insuficiente");
    this.idProducto = idProducto;
  }
}

async function onVentaConfirmada(event) {
  const { idVenta, items } = event.data;
  const conn = await pool.getConnection();
  const cambios = [];

  try {
    await conn.beginTransaction();

    // Si este evento ya se procesó, se ignora
    const [ins] = await conn.query(
      "INSERT IGNORE INTO eventos_procesados (event_id) VALUES (?)",
      [event.eventId],
    );
    if (ins.affectedRows === 0) {
      await conn.rollback();
      console.log("Evento duplicado, se ignora");
      return;
    }

    for (const it of items) {
      const [upd] = await conn.query(
        "UPDATE productos SET stock = stock - ? WHERE id = ? AND stock >= ?",
        [it.cantidad, it.idProducto, it.cantidad],
      );
      if (upd.affectedRows === 0)
        throw new StockInsuficienteError(it.idProducto);

      const [[p]] = await conn.query(
        "SELECT id, codigo, nombre, stock, stock_minimo FROM productos WHERE id = ?",
        [it.idProducto],
      );
      await conn.query(
        `INSERT INTO movimientos_stock
         (id_producto, tipo, cantidad, stock_resultante, motivo, referencia)
         VALUES (?, 'SALIDA', ?, ?, 'Venta', ?)`,
        [p.id, it.cantidad, p.stock, `venta-${idVenta}`],
      );
      cambios.push({ ...p, cantidad: it.cantidad });
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    if (e instanceof StockInsuficienteError) {
      publish("stock.insuficiente", "StockInsuficiente", {
        idVenta,
        idProducto: e.idProducto,
      });
      return;
    }
    throw e;
  } finally {
    conn.release();
  }

  // Los eventos se publican solo después de guardar en la base de datos
  for (const c of cambios) {
    publish("stock.actualizado", "StockActualizado", {
      idProducto: c.id,
      stockNuevo: c.stock,
      motivo: `venta-${idVenta}`,
    });
    if (c.stock <= c.stock_minimo) {
      publish("stock.bajo_minimo", "StockBajoMinimo", {
        idProducto: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        stockActual: c.stock,
        stockMinimo: c.stock_minimo,
      });
    }
  }
}

async function onMercanciaRecibida(event) {
  const { idPedido, items } = event.data;
  const conn = await pool.getConnection();
  const cambios = [];

  try {
    await conn.beginTransaction();

    const [ins] = await conn.query(
      "INSERT IGNORE INTO eventos_procesados (event_id) VALUES (?)",
      [event.eventId],
    );
    if (ins.affectedRows === 0) {
      await conn.rollback();
      console.log("Evento duplicado, se ignora");
      return;
    }

    for (const it of items) {
      const [upd] = await conn.query(
        "UPDATE productos SET stock = stock + ? WHERE id = ?",
        [it.cantidad, it.idProducto],
      );
      if (upd.affectedRows === 0) continue; // producto desconocido
      const [[p]] = await conn.query(
        "SELECT id, stock FROM productos WHERE id = ?",
        [it.idProducto],
      );
      await conn.query(
        `INSERT INTO movimientos_stock
         (id_producto, tipo, cantidad, stock_resultante, motivo, referencia)
         VALUES (?, 'ENTRADA', ?, ?, 'Compra', ?)`,
        [p.id, it.cantidad, p.stock, `pedido-${idPedido}`],
      );
      cambios.push(p);
    }

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  for (const c of cambios) {
    publish("stock.actualizado", "StockActualizado", {
      idProducto: c.id,
      stockNuevo: c.stock,
      motivo: `pedido-${idPedido}`,
    });
  }
}

async function registrarConsumidores() {
  await subscribe(
    "inventario.venta_confirmada",
    "venta.confirmada",
    onVentaConfirmada,
  );
  await subscribe(
    "inventario.mercancia_recibida",
    "mercancia.recibida",
    onMercanciaRecibida,
  );
}

module.exports = { registrarConsumidores };
