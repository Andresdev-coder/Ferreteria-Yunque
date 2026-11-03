const { pool, initSchema: createSchema } = require('../../shared/postgres');

async function initSchema() {
  await createSchema();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(120) NOT NULL,
      correo VARCHAR(150) NOT NULL UNIQUE,
      password_hash VARCHAR(100) NOT NULL,
      rol VARCHAR(30) NOT NULL CHECK (rol IN ('ADMINISTRADOR','VENDEDOR','BODEGUERO')),
      activo SMALLINT NOT NULL DEFAULT 1,
      creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
  console.log('PostgreSQL listo: tabla de usuarios verificada');
}

module.exports = { pool, initSchema };
