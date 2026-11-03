const { Pool } = require('pg');

const schema = (process.env.PG_SCHEMA || process.env.DB_NAME || 'public').replace(/[^a-zA-Z0-9_]/g, '');
if (!schema) throw new Error('PG_SCHEMA debe ser un nombre de esquema PostgreSQL válido');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  max: 5,
});

function prepare(sql, values = []) {
  const params = [];
  let valueIndex = 0;
  const text = sql.replace(/\?/g, (placeholder, offset, source) => {
    const value = values[valueIndex++];
    const inList = /\bIN\s*\(\s*$/.test(source.slice(0, offset));
    if (inList && Array.isArray(value)) {
      if (!value.length) return 'NULL';
      const start = params.length + 1;
      params.push(...value);
      return value.map((_, i) => `$${start + i}`).join(', ');
    }
    params.push(value);
    return `$${params.length}`;
  });
  return { text, values: params };
}

async function query(sql, values = []) {
  const normalized = migrateSql(sql.trim());
  const isInsert = /^INSERT\s+INTO\b/i.test(normalized);
  const isSelect = /^SELECT\b/i.test(normalized);
  const wantsInsertId = isInsert && /\bRETURNING\s+id\b/i.test(normalized);
  let { text, values: params } = prepare(normalized, values);
  const result = await pool.query(text, params);
  if (isSelect) return [result.rows];
  const inserted = wantsInsertId ? result.rows[0]?.id : undefined;
  return [{ affectedRows: result.rowCount, insertId: inserted }];
}

function getConnection() {
  return pool.connect().then((client) => ({
    query: (sql, values) => queryWith(client, sql, values),
    beginTransaction: () => client.query('BEGIN'),
    commit: () => client.query('COMMIT'),
    rollback: () => client.query('ROLLBACK'),
    release: () => client.release(),
  }));
}

async function queryWith(client, sql, values = []) {
  const normalized = migrateSql(sql.trim());
  const isInsert = /^INSERT\s+INTO\b/i.test(normalized);
  const isSelect = /^SELECT\b/i.test(normalized);
  const wantsInsertId = isInsert && /\bRETURNING\s+id\b/i.test(normalized);
  let { text, values: params } = prepare(normalized, values);
  const result = await client.query(text, params);
  return isSelect ? [result.rows] : [{ affectedRows: result.rowCount, insertId: wantsInsertId ? result.rows[0]?.id : undefined }];
}

function migrateSql(sql) {
  const ignore = /^INSERT\s+IGNORE\s+INTO/i.test(sql);
  let transformed = sql
    .replace(/INT\s+AUTO_INCREMENT\s+PRIMARY\s+KEY/gi, 'SERIAL PRIMARY KEY')
    .replace(/TINYINT\s*\(\s*1\s*\)/gi, 'SMALLINT')
    .replace(/ENUM\s*\(([^)]*)\)/gi, 'VARCHAR(30)')
    .replace(/INSERT\s+IGNORE\s+INTO/gi, 'INSERT INTO');
  const duplicate = transformed.match(/ON DUPLICATE KEY UPDATE([\s\S]*)$/i);
  if (duplicate) {
    const table = transformed.match(/INSERT\s+INTO\s+(?:"[^"]+"\.)?(\w+)/i)?.[1];
    const keys = { productos_cache: 'id', producto_ventas: 'id_producto', ventas_resumen_diario: 'fecha' };
    if (!keys[table]) throw new Error(`Falta definir la clave ON CONFLICT para ${table}`);
    const updates = duplicate[1].replace(/VALUES\((\w+)\)/gi, 'EXCLUDED.$1');
    transformed = `${transformed.slice(0, duplicate.index)}ON CONFLICT (${keys[table]}) DO UPDATE SET${updates}`;
  }
  if (ignore) transformed += ' ON CONFLICT DO NOTHING';
  return transformed.replace(
    /\b(FROM|JOIN|INTO|UPDATE|TABLE|REFERENCES)\s+(IF\s+NOT\s+EXISTS\s+)?(productos_cache|producto_ventas|ventas_resumen_diario|eventos_procesados|usuarios|productos|movimientos_stock|ventas|venta_items|proveedores|pedidos|pedido_items|numeracion|facturas|factura_items)\b/gi,
    (_, keyword, ifNotExists = '', table) => `${keyword} ${ifNotExists}"${schema}".${table}`
  );
}

async function initSchema() {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
}

module.exports = { pool: { query, getConnection }, initSchema };
