const express = require('express');
const { pool } = require('../db');
const { registrarVenta } = require('../events/consumers');

const router = express.Router();

router.get('/ventas-por-categoria', async (req, res) => {
  const [rows] = await pool.query(
    `SELECT categoria, SUM(unidades_vendidas) AS unidades, SUM(total_vendido) AS total
     FROM producto_ventas
     GROUP BY categoria
     ORDER BY total DESC`
  );
  res.json(rows);
});

router.get('/productos-mas-vendidos', async (req, res) => {
  const limite = Math.min(Number(req.query.limit) || 6, 20);
  const [rows] = await pool.query(
    `SELECT id_producto, nombre, categoria, unidades_vendidas, total_vendido
     FROM producto_ventas
     ORDER BY unidades_vendidas DESC
     LIMIT ?`,
    [limite]
  );
  res.json(rows);
});

router.get('/ventas-diarias', async (req, res) => {
  const dias = Math.min(Number(req.query.dias) || 14, 90);
  const [rows] = await pool.query(
    `SELECT fecha, total_ventas, cantidad_ventas
     FROM ventas_resumen_diario
     WHERE fecha >= CURRENT_DATE - (? * INTERVAL '1 day')
     ORDER BY fecha`,
    [dias]
  );
  res.json(rows);
});

// Reconstruye las vistas de lectura desde cero, trayendo el historial
// completo de Ventas. Sirve para ventas que ocurrieron antes de que
// Reportes existiera (el mismo caso que ya vimos con Facturación).
router.post('/recalcular', async (req, res) => {
  const base = process.env.VENTAS_URL;
  let lista;
  try {
    const r = await fetch(`${base}/ventas`);
    if (!r.ok) throw new Error(`Ventas respondió ${r.status}`);
    lista = await r.json();
  } catch (e) {
    return res.status(502).json({ error: `No se pudo contactar a Ventas (${base}): ${e.message}` });
  }

  const confirmadas = lista.filter((v) => v.estado === 'CONFIRMADA');
  const detalles = [];
  for (const v of confirmadas) {
    const rd = await fetch(`${base}/ventas/${v.id}`);
    if (rd.ok) detalles.push(await rd.json());
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM producto_ventas');
    await conn.query('DELETE FROM ventas_resumen_diario');
    for (const v of detalles) {
      const items = v.items.map((i) => ({
        idProducto: i.id_producto,
        nombre: i.nombre,
        cantidad: i.cantidad,
        subtotal: Number(i.subtotal),
      }));
      await registrarVenta(conn, { items, total: Number(v.total), fecha: new Date(v.creado_en).toISOString() });
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  res.json({ ventasProcesadas: detalles.length });
});

module.exports = router;
