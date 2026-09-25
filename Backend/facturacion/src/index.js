require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initSchema } = require('./db');
const { connectRabbit } = require('./rabbit');
const { registrarConsumidores } = require('./events/consumers');
const facturas = require('./routes/facturas');

async function main() {
  await initSchema();
  await connectRabbit();
  await registrarConsumidores();

  const app = express();
  app.use(cors());
  app.use(express.json());
  app.get('/health', (req, res) => res.json({ servicio: 'facturacion', estado: 'ok' }));
  app.use('/facturas', facturas);

  app.listen(process.env.PORT, () =>
    console.log(`Facturación escuchando en http://localhost:${process.env.PORT}`)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});