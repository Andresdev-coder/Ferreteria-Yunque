require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { connectRabbit, escucharTodo } = require('./rabbit');
const jwt = require('jsonwebtoken');

async function main() {
  const app = express();
  app.use(cors({ origin: process.env.FRONT_ORIGIN }));
  // Ojo: aquí NO va express.json(); el proxy necesita el cuerpo intacto

  app.get('/health', (req, res) => res.json({ servicio: 'gateway', estado: 'ok' }));

  function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Debes iniciar sesión.' });
  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Sesión inválida o expirada.' });
  }
}

  // El frontend solo conoce el gateway; este reenvía a cada servicio
    app.use('/api/usuarios', createProxyMiddleware({
    target: process.env.USUARIOS_URL,
    changeOrigin: true,
    pathRewrite: { '^/api/usuarios': '' },
  }));

  const protegidas = {
    '/api/inventario': process.env.INVENTARIO_URL,
    '/api/ventas': process.env.VENTAS_URL,
    '/api/facturacion': process.env.FACTURACION_URL,
    '/api/compras': process.env.COMPRAS_URL,
    '/api/reportes': process.env.REPORTES_URL,
  };
  for (const [ruta, target] of Object.entries(protegidas)) {
    app.use(ruta, requireAuth, createProxyMiddleware({
      target,
      changeOrigin: true,
      pathRewrite: { [`^${ruta}`]: '' },
    }));
  }

  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: process.env.FRONT_ORIGIN } });
  io.on('connection', (socket) => console.log(`Cliente conectado: ${socket.id}`));

  await connectRabbit();
  // Cada evento del negocio se reenvía tal cual a los navegadores conectados
  await escucharTodo((event) => io.emit('evento', event));

  server.listen(process.env.PORT, () =>
    console.log(`Gateway escuchando en http://localhost:${process.env.PORT}`)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});