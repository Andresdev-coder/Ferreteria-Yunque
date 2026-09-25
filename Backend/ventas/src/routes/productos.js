const express = require('express');
const { pool } = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  const q = `%${req.query.q || ''}%`;
  const [rows] = await pool.query(
    `SELECT id, codigo, nombre, categoria, precio, stock
     FROM productos_cache
     WHERE activo = 1 AND (nombre LIKE ? OR codigo LIKE ?)
     ORDER BY nombre LIMIT 50`,
    [q, q]
  );
  res.json(rows);
});

module.exports = router;