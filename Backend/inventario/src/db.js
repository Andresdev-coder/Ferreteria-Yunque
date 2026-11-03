const { pool, initSchema: createSchema } = require('../../shared/postgres');

async function initSchema() {
  await createSchema();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS productos (
      id SERIAL PRIMARY KEY,
      codigo VARCHAR(50) NOT NULL UNIQUE,
      nombre VARCHAR(150) NOT NULL,
      categoria VARCHAR(80) NOT NULL DEFAULT 'General',
      precio DECIMAL(12,2) NOT NULL,
      stock INT NOT NULL DEFAULT 0,
      stock_minimo INT NOT NULL DEFAULT 5,
      activo SMALLINT NOT NULL DEFAULT 1,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  // Auditoría de cada cambio de stock (RF-12 / RNF-09)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS movimientos_stock (
      id SERIAL PRIMARY KEY,
      id_producto INT NOT NULL,
      tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('SALIDA','ENTRADA')),
      cantidad INT NOT NULL,
      stock_resultante INT NOT NULL,
      motivo VARCHAR(100),
      referencia VARCHAR(100),
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  // Idempotencia (RNF-07): guarda los eventos ya procesados
  await pool.query(`
    CREATE TABLE IF NOT EXISTS eventos_procesados (
      event_id VARCHAR(64) PRIMARY KEY,
      procesado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  console.log('PostgreSQL listo: tablas de inventario verificadas');
}

module.exports = { pool, initSchema };
