const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: 'Z',
  waitForConnections: true,
  connectionLimit: 10,
});

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS productos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      codigo VARCHAR(50) NOT NULL UNIQUE,
      nombre VARCHAR(150) NOT NULL,
      categoria VARCHAR(80) NOT NULL DEFAULT 'General',
      precio DECIMAL(12,2) NOT NULL,
      stock INT NOT NULL DEFAULT 0,
      stock_minimo INT NOT NULL DEFAULT 5,
      activo TINYINT(1) NOT NULL DEFAULT 1,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  // Auditoría de cada cambio de stock (RF-12 / RNF-09)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS movimientos_stock (
      id INT AUTO_INCREMENT PRIMARY KEY,
      id_producto INT NOT NULL,
      tipo ENUM('SALIDA','ENTRADA') NOT NULL,
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

  console.log('MySQL listo: tablas de inventario verificadas');
}

module.exports = { pool, initSchema };