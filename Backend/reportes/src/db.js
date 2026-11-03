const { pool, initSchema: createSchema } = require('../../shared/postgres');

async function initSchema() {
  await createSchema();
  // Copia local de productos, solo para conocer su categoría
  await pool.query(`
    CREATE TABLE IF NOT EXISTS productos_cache (
      id INT PRIMARY KEY,
      nombre VARCHAR(150) NOT NULL,
      categoria VARCHAR(80) NOT NULL DEFAULT 'General'
    )`);

  // Vista de lectura: acumulado de ventas por producto
  await pool.query(`
    CREATE TABLE IF NOT EXISTS producto_ventas (
      id_producto INT PRIMARY KEY,
      nombre VARCHAR(150) NOT NULL,
      categoria VARCHAR(80) NOT NULL DEFAULT 'General',
      unidades_vendidas INT NOT NULL DEFAULT 0,
      total_vendido DECIMAL(14,2) NOT NULL DEFAULT 0
    )`);

  // Vista de lectura: total vendido por día
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ventas_resumen_diario (
      fecha DATE PRIMARY KEY,
      total_ventas DECIMAL(14,2) NOT NULL DEFAULT 0,
      cantidad_ventas INT NOT NULL DEFAULT 0
    )`);

  // Idempotencia
  await pool.query(`
    CREATE TABLE IF NOT EXISTS eventos_procesados (
      event_id VARCHAR(64) PRIMARY KEY,
      procesado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

  console.log('PostgreSQL listo: tablas de reportes verificadas');
}

module.exports = { pool, initSchema };
