require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initSchema } = require('./db');
const auth = require('./routes/auth');
const usuarios = require('./routes/usuarios');

// Usuarios es el único servicio que no toca RabbitMQ: la autenticación es
// un asunto transversal (cada petición la resuelve el propio JWT), no un
// hecho de negocio que otros servicios necesiten saber que ocurrió.
async function main() {
  await initSchema();

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get('/health', (req, res) => res.json({ servicio: 'usuarios', estado: 'ok' }));
  app.use('/auth', auth);
  app.use('/usuarios', usuarios);

  app.listen(process.env.PORT, () =>
    console.log(`Usuarios escuchando en http://localhost:${process.env.PORT}`)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
