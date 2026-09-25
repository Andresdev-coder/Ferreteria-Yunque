const { pool } = require('../db');
const { subscribe } = require('../rabbit');

// Mantiene la copia local de productos (creados y actualizados)
async function onProducto(event) {
  const p = event.data;
  await pool.query(
    `INSERT INTO productos_cache (id, codigo, nombre, categoria, precio, stock, activo)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       codigo = VALUES(codigo), nombre = VALUES(nombre), categoria = VALUES(categoria),
       precio = VALUES(precio), stock = VALUES(stock), activo = VALUES(activo)`,
    [p.id, p.codigo, p.nombre, p.categoria ?? 'General', p.precio, p.stock ?? 0, p.activo ?? 1]
  );
}

// Inventario avisa el nuevo stock tras cada movimiento
async function onStockActualizado(event) {
  const { idProducto, stockNuevo } = event.data;
  await pool.query('UPDATE productos_cache SET stock = ? WHERE id = ?', [stockNuevo, idProducto]);
}

// Inventario no pudo descontar: la venta se rechaza
async function onStockInsuficiente(event) {
  const { idVenta, idProducto } = event.data;
  await pool.query(
    "UPDATE ventas SET estado = 'RECHAZADA', motivo = ? WHERE id = ?",
    [`Stock insuficiente del producto ${idProducto}`, idVenta]
  );
}

// Facturación avisa el número de factura de la venta
async function onFacturaGenerada(event) {
  const { idVenta, numero } = event.data;
  await pool.query('UPDATE ventas SET factura_numero = ? WHERE id = ?', [numero, idVenta]);
}

async function registrarConsumidores() {
  await subscribe('ventas.productos', 'producto.*', onProducto);
  await subscribe('ventas.stock', 'stock.actualizado', onStockActualizado);
  await subscribe('ventas.rechazos', 'stock.insuficiente', onStockInsuficiente);
  await subscribe('ventas.facturas', 'factura.generada', onFacturaGenerada);
}

module.exports = { registrarConsumidores };