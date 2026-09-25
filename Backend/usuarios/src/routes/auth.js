const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { pool } = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
const loginSchema = z.object({ correo: z.string().trim().email(), password: z.string().min(1) });

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Escribe un correo y una contraseña.' });
  const { correo, password } = parsed.data;

  const [[u]] = await pool.query('SELECT * FROM usuarios WHERE correo = ? AND activo = 1', [correo]);
  // Mismo mensaje si el correo no existe o la contraseña falla: no se revela cuál de los dos fue
  if (!u || !(await bcrypt.compare(password, u.password_hash))) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }

  const payload = { sub: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, usuario: payload });
});

// El frontend la usa para restaurar la sesión al recargar la página
router.get('/me', verifyToken, (req, res) => res.json(req.usuario));

module.exports = router;
