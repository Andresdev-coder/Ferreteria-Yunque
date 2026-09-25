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
  // Copia local de los productos de Inventario, alimentada por eventos
  await pool.query(`
    CREATE TABLE IF NOT EXISTS productos_cache (
      id INT PRIMARY KEY,
      codigo VARCHAR(50) NOT NULL,
      nombre VARCHAR(150) NOT NULL,
      categoria VARCHAR(80) NOT NULL DEFAULT 'General',
      precio DECIMAL(12,2) NOT NULL,
      stock INT NOT NULL DEFAULT 0,
      activo TINYINT(1) NOT NULL DEFAULT 1
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ventas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cliente VARCHAR(150),
      vendedor VARCHAR(100) NOT NULL,
      subtotal DECIMAL(12,2) NOT NULL,
      impuesto DECIMAL(12,2) NOT NULL,
      total DECIMAL(12,2) NOT NULL,
      estado ENUM('CONFIRMADA','RECHAZADA') NOT NULL DEFAULT 'CONFIRMADA',
      motivo VARCHAR(200),
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS venta_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      id_venta INT NOT NULL,
      id_producto INT NOT NULL,
      nombre VARCHAR(150) NOT NULL,
      cantidad INT NOT NULL,
      precio_unitario DECIMAL(12,2) NOT NULL,
      subtotal DECIMAL(12,2) NOT NULL,
      FOREIGN KEY (id_venta) REFERENCES ventas(id)
    )`);

   // Número de factura, lo llena el evento FacturaGenerada
  try {
    await pool.query('ALTER TABLE ventas ADD COLUMN factura_numero VARCHAR(30) NULL');
  } catch (e) {
    if (e.code !== 'ER_DUP_FIELDNAME') throw e; // si ya existe, no pasa nada
  }

  console.log('MySQL listo: tablas de ventas verificadas');
}

module.exports = { pool, initSchema };