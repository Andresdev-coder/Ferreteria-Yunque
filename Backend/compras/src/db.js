const { pool, initSchema: createSchema } = require('../../shared/postgres');

async function initSchema() {
  await createSchema();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS proveedores (
      id INT AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(150) NOT NULL,
      telefono VARCHAR(50),
      correo VARCHAR(120),
      activo TINYINT(1) NOT NULL DEFAULT 1,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  // Copia local de los productos de Inventario, alimentada por eventos
  await pool.query(`
    CREATE TABLE IF NOT EXISTS productos_cache (
      id INT PRIMARY KEY,
      codigo VARCHAR(50) NOT NULL,
      nombre VARCHAR(150) NOT NULL,
      activo TINYINT(1) NOT NULL DEFAULT 1
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      id_proveedor INT NULL,
      estado ENUM('SUGERIDO','CREADO','ENVIADO','RECIBIDO','CANCELADO') NOT NULL,
      origen ENUM('AUTOMATICO','MANUAL') NOT NULL,
      recibido_por VARCHAR(100),
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      enviado_en TIMESTAMP NULL,
      recibido_en TIMESTAMP NULL,
      FOREIGN KEY (id_proveedor) REFERENCES proveedores(id)
    )`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS pedido_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      id_pedido INT NOT NULL,
      id_producto INT NOT NULL,
      nombre VARCHAR(150) NOT NULL,
      cantidad INT NOT NULL,
      FOREIGN KEY (id_pedido) REFERENCES pedidos(id)
    )`);

  // Idempotencia: eventos ya procesados
  await pool.query(`
    CREATE TABLE IF NOT EXISTS eventos_procesados (
      event_id VARCHAR(64) PRIMARY KEY,
      procesado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  console.log('PostgreSQL listo: tablas de compras verificadas');
}

module.exports = { pool, initSchema };
