import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Minus, Plus, Trash2 } from 'lucide-react';
import api from '../api';
import { useEventos } from '../socket';
import { money } from '../utils';
import Card, { Vacio } from '../components/Card';

const campo =
  'w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';

export default function Ventas() {
  const [q, setQ] = useState('');
  const [productos, setProductos] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [cliente, setCliente] = useState('');
  const [vendedor, setVendedor] = useState('Maria');
  const [enviando, setEnviando] = useState(false);

  const buscar = useCallback(async () => {
    try {
      const { data } = await api.get('/ventas/productos', { params: { q } });
      setProductos(data);
    } catch (e) {
      console.error(e);
    }
  }, [q]);

  useEffect(() => {
    const t = setTimeout(buscar, 250);
    return () => clearTimeout(t);
  }, [buscar]);
  useEventos(buscar);

  const agregar = (p) =>
    setCarrito((c) => {
      const existe = c.find((i) => i.id === p.id);
      if (existe) {
        return c.map((i) => (i.id === p.id ? { ...i, cantidad: Math.min(i.cantidad + 1, p.stock) } : i));
      }
      return [...c, { id: p.id, nombre: p.nombre, precio: Number(p.precio), stock: p.stock, cantidad: 1 }];
    });

  const cambiar = (id, delta) =>
    setCarrito((c) =>
      c.map((i) => (i.id === id ? { ...i, cantidad: Math.max(1, Math.min(i.stock, i.cantidad + delta)) } : i))
    );

  const quitar = (id) => setCarrito((c) => c.filter((i) => i.id !== id));

  const subtotal = carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);

  const confirmar = async () => {
    if (!vendedor.trim()) return toast.error('Escribe el nombre del vendedor.');
    setEnviando(true);
    try {
      await api.post('/ventas/ventas', {
        cliente: cliente.trim() || undefined,
        vendedor: vendedor.trim(),
        items: carrito.map((i) => ({ idProducto: i.id, cantidad: i.cantidad })),
      });
      // La confirmación llega como aviso en vivo (evento VentaConfirmada)
      setCarrito([]);
      setCliente('');
    } catch (e) {
      const errores = e.response?.data?.errores;
      if (errores) errores.forEach((m) => toast.error(m));
      else toast.error('No se pudo registrar la venta. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <Card titulo="Productos" extra="Busca por nombre o código" className="lg:col-span-3">
        <input className={campo} placeholder="Buscar producto…" value={q} onChange={(e) => setQ(e.target.value)} />
        <ul className="mt-4 divide-y divide-gray-100">
          {productos.length === 0 && <Vacio texto="No hay productos que coincidan con la búsqueda." />}
          {productos.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{p.nombre}</p>
                <p className="text-xs text-gray-400">
                  {p.codigo} · {p.categoria}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-bold">{money(p.precio)}</p>
                  <p className={`text-xs font-medium ${p.stock === 0 ? 'text-rose-500' : 'text-gray-400'}`}>
                    {p.stock === 0 ? 'Agotado' : `${p.stock} en stock`}
                  </p>
                </div>
                <button
                  onClick={() => agregar(p)}
                  disabled={p.stock === 0}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                >
                  Agregar
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card titulo="Venta actual" className="h-fit lg:col-span-2">
        {carrito.length === 0 ? (
          <Vacio texto="Agrega productos de la lista para empezar una venta." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {carrito.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{i.nombre}</p>
                  <p className="text-xs text-gray-400">{money(i.precio)} c/u</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button onClick={() => cambiar(i.id, -1)} className="rounded-full bg-gray-100 p-1.5 hover:bg-gray-200" aria-label="Quitar una unidad">
                    <Minus size={14} />
                  </button>
                  <span className="w-6 text-center text-sm font-bold">{i.cantidad}</span>
                  <button onClick={() => cambiar(i.id, 1)} className="rounded-full bg-gray-100 p-1.5 hover:bg-gray-200" aria-label="Agregar una unidad">
                    <Plus size={14} />
                  </button>
                  <button onClick={() => quitar(i.id)} className="ml-1 rounded-full p-1.5 text-rose-500 hover:bg-rose-50" aria-label="Quitar producto">
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 space-y-3">
          <input className={campo} placeholder="Cliente (opcional)" value={cliente} onChange={(e) => setCliente(e.target.value)} />
          <input className={campo} placeholder="Vendedor" value={vendedor} onChange={(e) => setVendedor(e.target.value)} />
        </div>

        <div className="mt-5 flex items-baseline justify-between border-t border-gray-100 pt-4">
          <span className="text-sm text-gray-500">Subtotal</span>
          <span className="text-2xl font-extrabold">{money(subtotal)}</span>
        </div>
        <p className="mt-1 text-xs text-gray-400">El impuesto y el total se calculan al confirmar.</p>

        <button
          onClick={confirmar}
          disabled={carrito.length === 0 || enviando}
          className="mt-4 w-full rounded-2xl bg-emerald-500 py-3 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
        >
          {enviando ? 'Confirmando…' : 'Confirmar venta'}
        </button>
      </Card>
    </div>
  );
}
