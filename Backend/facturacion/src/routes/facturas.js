const express = require('express');
const PDFDocument = require('pdfkit');
const { pool } = require('../db');

const router = express.Router();
const money = (n) => '$ ' + Number(n).toLocaleString('es-CO');

async function cargarFactura(id) {
  const [[factura]] = await pool.query('SELECT * FROM facturas WHERE id = ?', [id]);
  if (!factura) return null;
  const [items] = await pool.query('SELECT * FROM factura_items WHERE id_factura = ?', [id]);
  return { ...factura, items };
}

router.get('/', async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM facturas ORDER BY id DESC LIMIT 100');
  res.json(rows);
});

// Va antes de "/:id" para que no lo confunda con un id
router.get('/venta/:idVenta', async (req, res) => {
  const [[f]] = await pool.query('SELECT id FROM facturas WHERE id_venta = ?', [req.params.idVenta]);
  if (!f) return res.status(404).json({ error: 'Esa venta aún no tiene factura' });
  res.json(await cargarFactura(f.id));
});

router.get('/:id/pdf', async (req, res) => {
  const f = await cargarFactura(req.params.id);
  if (!f) return res.status(404).json({ error: 'Factura no encontrada' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${f.numero}.pdf"`);

  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);

  doc.fontSize(22).fillColor('#065F46').text('Ferretería Yunque');
  doc.fontSize(10).fillColor('#6B7280').text('Factura de venta');
  doc.moveDown();
  doc.fontSize(12).fillColor('#111827').text(`Factura No. ${f.numero}`);
  doc.fontSize(10).text(`Fecha: ${new Date(f.emitida_en).toLocaleString('es-CO')}`);
  doc.text(`Cliente: ${f.cliente || 'Cliente general'}`);
  doc.text(`Vendedor: ${f.vendedor || '-'}`);

  // Encabezado de la tabla
  let y = doc.y + 15;
  doc.rect(50, y, 500, 22).fill('#10B981');
  doc.fillColor('#FFFFFF').fontSize(10);
  doc.text('Producto', 58, y + 6);
  doc.text('Cant.', 320, y + 6, { width: 50, align: 'right' });
  doc.text('P. unitario', 380, y + 6, { width: 80, align: 'right' });
  doc.text('Subtotal', 470, y + 6, { width: 72, align: 'right' });
  y += 32;

  doc.fillColor('#111827');
  for (const it of f.items) {
    if (y > 720) { doc.addPage(); y = 50; }
    doc.text(it.nombre, 58, y, { width: 250 });
    doc.text(String(it.cantidad), 320, y, { width: 50, align: 'right' });
    doc.text(money(it.precio_unitario), 380, y, { width: 80, align: 'right' });
    doc.text(money(it.subtotal), 470, y, { width: 72, align: 'right' });
    y += 22;
  }

  // Totales
  y += 8;
  doc.moveTo(50, y).lineTo(550, y).strokeColor('#D1D5DB').stroke();
  y += 12;
  doc.font('Helvetica').fontSize(10);
  doc.text('Subtotal', 380, y, { width: 80, align: 'right' });
  doc.text(money(f.subtotal), 470, y, { width: 72, align: 'right' });
  y += 18;
  doc.text('Impuesto', 380, y, { width: 80, align: 'right' });
  doc.text(money(f.impuesto), 470, y, { width: 72, align: 'right' });
  y += 20;
  doc.font('Helvetica-Bold').fontSize(12);
  doc.text('Total', 380, y, { width: 80, align: 'right' });
  doc.text(money(f.total), 470, y, { width: 72, align: 'right' });

  doc.end();
});

router.get('/:id', async (req, res) => {
  const f = await cargarFactura(req.params.id);
  if (!f) return res.status(404).json({ error: 'Factura no encontrada' });
  res.json(f);
});

module.exports = router;