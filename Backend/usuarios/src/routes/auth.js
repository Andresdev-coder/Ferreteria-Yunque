const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');
const nodemailer = require('nodemailer');
const { z } = require('zod');
const { pool } = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
const loginSchema = z.object({ correo: z.string().trim().email(), password: z.string().min(1) });
const forgotSchema = z.object({ correo: z.string().trim().email() });
const resetSchema = z.object({ token: z.string().min(32), password: z.string().min(8) });
const changePasswordSchema = z.object({
  actual: z.string().min(1),
  nueva: z.string().min(8),
});

function crearTransportador() {
  const { SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    service: process.env.SMTP_SERVICE || 'gmail',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Escribe un correo y una contraseña.' });
  const { correo, password } = parsed.data;

  const [[u]] = await pool.query('SELECT * FROM usuarios WHERE correo = ? AND activo = 1', [correo]);
  if (!u || !(await bcrypt.compare(password, u.password_hash))) {
    return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  }

  const payload = { sub: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, usuario: payload });
});

router.post('/change-password', verifyToken, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'La contraseña nueva debe tener al menos 8 caracteres.' });
  }

  const [[usuario]] = await pool.query(
    'SELECT password_hash FROM usuarios WHERE id = ? AND activo = 1',
    [req.usuario.sub]
  );
  if (!usuario || !(await bcrypt.compare(parsed.data.actual, usuario.password_hash))) {
    return res.status(400).json({ error: 'La contraseña actual no es correcta.' });
  }

  const hash = await bcrypt.hash(parsed.data.nueva, 12);
  await pool.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [hash, req.usuario.sub]);
  await pool.query('DELETE FROM password_reset_tokens WHERE user_id = ?', [req.usuario.sub]);
  res.json({ mensaje: 'Contraseña actualizada.' });
});

router.post('/forgot-password', async (req, res) => {
  const mensaje = 'Si el correo corresponde a una cuenta activa, enviaremos instrucciones para restablecer la contraseña.';
  const parsed = forgotSchema.safeParse(req.body);
  if (!parsed.success) return res.json({ mensaje });

  const transporter = crearTransportador();
  const frontendUrl = process.env.FRONTEND_URL;
  if (!transporter || !frontendUrl) {
    console.warn('Recuperación por correo no configurada. Define SMTP_USER, SMTP_PASS y FRONTEND_URL.');
    return res.json({ mensaje });
  }

  const [[usuario]] = await pool.query(
    "SELECT id, correo FROM usuarios WHERE correo = ? AND activo = 1 AND rol = 'ADMINISTRADOR'",
    [parsed.data.correo]
  );
  if (!usuario) return res.json({ mensaje });

  const [solicitudes] = await pool.query(
    `SELECT id FROM password_reset_tokens
     WHERE user_id = ? AND creado_en > NOW() - INTERVAL '1 minute'
     LIMIT 1`,
    [usuario.id]
  );
  if (solicitudes.length) return res.json({ mensaje });

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await pool.query(
    'DELETE FROM password_reset_tokens WHERE user_id = ? AND (used_at IS NOT NULL OR expires_at <= NOW())',
    [usuario.id]
  );
  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES (?, ?, NOW() + INTERVAL '20 minutes')`,
    [usuario.id, tokenHash]
  );

  const url = new URL('/restablecer-contrasena', frontendUrl);
  url.searchParams.set('token', token);
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: usuario.correo,
      subject: 'Restablece tu contraseña de Ferretería Yunque',
      text: `Usa este enlace para restablecer tu contraseña. Vence en 20 minutos: ${url.toString()}`,
      html: `<p>Solicitaste restablecer tu contraseña.</p><p><a href="${url.toString()}">Crear una contraseña nueva</a></p><p>El enlace vence en 20 minutos. Si no solicitaste este cambio, ignora este mensaje.</p>`,
    });
  } catch (error) {
    await pool.query('DELETE FROM password_reset_tokens WHERE token_hash = ?', [tokenHash]);
    console.error('No se pudo enviar el correo de recuperación:', error.code || error.message);
  }

  res.json({ mensaje });
});

router.post('/reset-password', async (req, res) => {
  const parsed = resetSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'El enlace no es válido o la contraseña no cumple los requisitos.' });
  }

  const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex');
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [tokens] = await conn.query(
      `SELECT t.user_id FROM password_reset_tokens t
       JOIN usuarios u ON u.id = t.user_id
       WHERE t.token_hash = ? AND t.used_at IS NULL AND t.expires_at > NOW()
         AND u.activo = 1 AND u.rol = 'ADMINISTRADOR'
       LIMIT 1 FOR UPDATE`,
      [tokenHash]
    );
    if (!tokens.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'El enlace expiró o ya fue utilizado. Solicita uno nuevo.' });
    }

    const hash = await bcrypt.hash(parsed.data.password, 12);
    const userId = tokens[0].user_id;
    await conn.query('UPDATE usuarios SET password_hash = ? WHERE id = ? AND activo = 1', [hash, userId]);
    await conn.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE token_hash = ?', [tokenHash]);
    await conn.query('DELETE FROM password_reset_tokens WHERE user_id = ? AND token_hash <> ?', [userId, tokenHash]);
    await conn.commit();
    res.json({ mensaje: 'Contraseña restablecida. Ya puedes iniciar sesión.' });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
});

// El frontend la usa para restaurar la sesión al recargar la página.
router.get('/me', verifyToken, (req, res) => res.json(req.usuario));

module.exports = router;
