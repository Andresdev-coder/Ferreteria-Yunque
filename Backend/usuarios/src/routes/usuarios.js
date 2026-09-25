const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { pool } = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();
const ROLES = ['ADMINISTRADOR', 'VENDEDOR', 'BODEGUERO'];

const crearSchema = z.object({
  nombre: z.string().trim().min(1),
  correo: z.string().trim().email(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
  rol: z.enum(ROLES).optional(),
});

// El primer usuario del sistema (el administrador) se crea sin sesión, porque
// todavía no hay nadie con quién autenticarse. De ahí en adelante, crear
// usuarios exige estar logueado como Administrador.
async function condicionalAuth(req, res, next) {
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM usuarios');
  req.esBootstrap = total === 0;
  if (req.esBootstrap) return next();
  return verifyToken(req, res, () => requireRole('ADMINISTRADOR')(req, res, next));
}

router.post('/', condicionalAuth, async (req, res) => {
  const parsed = crearSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Datos inválidos.' });
  }
  const { nombre, correo, password } = parsed.data;
  const rol = req.esBootstrap ? 'ADMINISTRADOR' : parsed.data.rol;
  if (!rol) return res.status(400).json({ error: 'Elige un rol para el usuario.' });

  const hash = await bcrypt.hash(password, 10);
  try {
    const [r] = await pool.query(
      'INSERT INTO usuarios (nombre, correo, password_hash, rol) VALUES (?,?,?,?)',
      [nombre, correo, hash, rol]
    );
    res.status(201).json({ id: r.insertId, nombre, correo, rol });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ese correo ya está registrado.' });
    throw e;
  }
});

router.get('/', verifyToken, requireRole('ADMINISTRADOR'), async (req, res) => {
  const [rows] = await pool.query('SELECT id, nombre, correo, rol, activo FROM usuarios ORDER BY nombre');
  res.json(rows);
});

router.delete('/:id', verifyToken, requireRole('ADMINISTRADOR'), async (req, res) => {
  if (Number(req.params.id) === req.usuario.sub) {
    return res.status(400).json({ error: 'No puedes desactivar tu propio usuario.' });
  }
  await pool.query('UPDATE usuarios SET activo = 0 WHERE id = ?', [req.params.id]);
  res.status(204).end();
});

module.exports = router;
