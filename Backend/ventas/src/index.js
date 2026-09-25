require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initSchema } = require('./db');
const { connectRabbit } = require('./rabbit');
const { registrarConsumidores } = require('./events/consumers');
const productos = require('./routes/productos');
const ventas = require('./routes/ventas');

async function main() {
  await initSchema();
  await connectRabbit();
  await registrarConsumidores();

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get('/health', (req, res) => res.json({ servicio: 'ventas', estado: 'ok' }));
  app.use('/productos', productos);
  app.use('/ventas', ventas);

  app.listen(process.env.PORT, () =>
    console.log(`Ventas escuchando en http://localhost:${process.env.PORT}`)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});