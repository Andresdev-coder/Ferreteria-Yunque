const { pool, initSchema: createSchema } = require('../../shared/postgres');

async function initSchema() {
  await createSchema();
  // Contador de facturas: garantiza numeración consecutiva sin saltos
  await pool.query(`
    CREATE TABLE IF NOT EXISTS numeracion (
      serie VARCHAR(10) PRIMARY KEY,
      ultimo INT NOT NULL DEFAULT 0
    )`);
  await pool.query("INSERT INTO numeracion (serie, ultimo) VALUES ('FY', 0) ON CONFLICT (serie) DO NOTHING");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS facturas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      numero VARCHAR(20) NOT NULL UNIQUE,
      id_venta INT NOT NULL UNIQUE,
      cliente VARCHAR(150),
      vendedor VARCHAR(100),
      subtotal DECIMAL(12,2) NOT NULL,
      impuesto DECIMAL(12,2) NOT NULL,
      total DECIMAL(12,2) NOT NULL,
      emitida_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS factura_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      id_factura INT NOT NULL,
      id_producto INT NOT NULL,
      nombre VARCHAR(150) NOT NULL,
      cantidad INT NOT NULL,
      precio_unitario DECIMAL(12,2) NOT NULL,
      subtotal DECIMAL(12,2) NOT NULL,
      FOREIGN KEY (id_factura) REFERENCES facturas(id)
    )`);

  // Idempotencia: eventos ya procesados
  await pool.query(`
    CREATE TABLE IF NOT EXISTS eventos_procesados (
      event_id VARCHAR(64) PRIMARY KEY,
      procesado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  console.log('PostgreSQL listo: tablas de facturación verificadas');
}

module.exports = { pool, initSchema };
