const express = require('express');
const { z } = require('zod');
const { pool } = require('../db');

const router = express.Router();

const proveedorSchema = z.object({
  nombre: z.string().trim().min(1),
  telefono: z.string().trim().optional(),
  correo: z.string().trim().optional(),
});

router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM proveedores WHERE activo = 1 ORDER BY nombre');
  res.json(rows);
});

router.post('/', async (req, res) => {
  const parsed = proveedorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'El nombre del proveedor es obligatorio.' });
  const { nombre, telefono, correo } = parsed.data;
  const [r] = await pool.query(
    'INSERT INTO proveedores (nombre, telefono, correo) VALUES (?,?,?)',
    [nombre, telefono || null, correo || null]
  );
  res.status(201).json({ id: r.insertId, nombre, telefono: telefono || null, correo: correo || null });
});

module.exports = router;
