const express = require('express');
const { z } = require('zod');
const { pool } = require('../db');
const { publish } = require('../rabbit');

const router = express.Router();

const productoSchema = z.object({
  codigo: z.string().min(1),
  nombre: z.string().min(1),
  categoria: z.string().default('General'),
  precio: z.number().positive(),
  stock: z.number().int().min(0).default(0),
  stock_minimo: z.number().int().min(0).default(5),
});

router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM productos WHERE activo = 1 ORDER BY nombre');
  res.json(rows);
});

// Va antes de "/:id" para que no lo confunda con un id
router.get('/stock-bajo', async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM productos WHERE activo = 1 AND stock <= stock_minimo ORDER BY stock'
  );
  res.json(rows);
});

router.get('/:id', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM productos WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json(rows[0]);
});

router.post('/', async (req, res) => {
  const parsed = productoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const p = parsed.data;
  try {
    const [r] = await pool.query(
      'INSERT INTO productos (codigo, nombre, categoria, precio, stock, stock_minimo) VALUES (?,?,?,?,?,?) RETURNING id',
      [p.codigo, p.nombre, p.categoria, p.precio, p.stock, p.stock_minimo]
    );
    const producto = { id: r.insertId, ...p };
    publish('producto.creado', 'ProductoCreado', producto);
    res.status(201).json(producto);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'El código ya existe' });
    throw e;
  }
});

// Republica todos los productos para que otros servicios se sincronicen
router.post('/sincronizar', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM productos');
  rows.forEach((p) => publish('producto.actualizado', 'ProductoActualizado', p));
  res.json({ publicados: rows.length });
});

router.put('/:id', async (req, res) => {
  const parsed = productoSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const campos = Object.keys(parsed.data);
  if (!campos.length) return res.status(400).json({ error: 'Nada que actualizar' });

  const set = campos.map((c) => `${c} = ?`).join(', ');
  const [r] = await pool.query(`UPDATE productos SET ${set} WHERE id = ?`, [
    ...Object.values(parsed.data),
    req.params.id,
  ]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Producto no encontrado' });

  const [[producto]] = await pool.query('SELECT * FROM productos WHERE id = ?', [req.params.id]);
  publish('producto.actualizado', 'ProductoActualizado', producto);
  res.json(producto);
});

router.delete('/:id', async (req, res) => {
  await pool.query('UPDATE productos SET activo = 0 WHERE id = ?', [req.params.id]);
  const [[producto]] = await pool.query('SELECT * FROM productos WHERE id = ?', [req.params.id]);
  if (producto) publish('producto.actualizado', 'ProductoActualizado', producto);
  res.status(204).end();
});

module.exports = router;
