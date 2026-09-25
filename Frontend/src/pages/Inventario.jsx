import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Trash2 } from "lucide-react";
import api from "../api";
import { useEventos } from "../socket";
import { money } from "../utils";
import Card, { Vacio } from "../components/Card";
import { ModalConfirmar } from "../components/Modal";

const campo =
  "w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

const VACIO = {
  codigo: "",
  nombre: "",
  categoria: "",
  precio: "",
  stock: "",
  stock_minimo: "",
};

export default function Inventario() {
  const [params] = useSearchParams();
  const [productos, setProductos] = useState([]);
  const [soloBajo, setSoloBajo] = useState(params.get("bajo") === "1");
  const [form, setForm] = useState(VACIO);
  const [guardando, setGuardando] = useState(false);
  const [aEliminar, setAEliminar] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get("/inventario/productos");
      setProductos(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);
  useEventos(cargar);

  const cambiar = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const crear = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await api.post("/inventario/productos", {
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        categoria: form.categoria.trim() || "General",
        precio: Number(form.precio),
        stock: Number(form.stock || 0),
        stock_minimo: Number(form.stock_minimo || 5),
      });
      toast.success(`Producto "${form.nombre.trim()}" creado`);
      setForm(VACIO);
      cargar();
    } catch (err) {
      if (err.response?.status === 409)
        toast.error("Ese código ya existe. Usa uno distinto.");
      else if (err.response?.status === 400)
        toast.error(
          "Revisa los datos: código, nombre y un precio mayor a 0 son obligatorios.",
        );
      else toast.error("No se pudo crear el producto.");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    try {
      await api.delete(`/inventario/productos/${aEliminar.id}`);
      toast.success("Producto eliminado");
      cargar();
    } catch {
      toast.error("No se pudo eliminar el producto.");
    } finally {
      setAEliminar(null);
    }
  };

  const lista = soloBajo
    ? productos.filter((p) => p.stock <= p.stock_minimo)
    : productos;

  return (
    <div className="space-y-5">
      <Card titulo="Nuevo producto">
        <form
          onSubmit={crear}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
        >
          <input
            className={campo}
            placeholder="Código"
            value={form.codigo}
            onChange={cambiar("codigo")}
            required
          />
          <input
            className={`${campo} lg:col-span-2`}
            placeholder="Nombre"
            value={form.nombre}
            onChange={cambiar("nombre")}
            required
          />
          <input
            className={campo}
            placeholder="Categoría"
            value={form.categoria}
            onChange={cambiar("categoria")}
          />
          <input
            className={campo}
            type="number"
            min="1"
            step="any"
            placeholder="Precio"
            value={form.precio}
            onChange={cambiar("precio")}
            required
          />
          <input
            className={campo}
            type="number"
            min="0"
            placeholder="Stock inicial"
            value={form.stock}
            onChange={cambiar("stock")}
          />
          <input
            className={campo}
            type="number"
            min="0"
            placeholder="Stock mínimo (5)"
            value={form.stock_minimo}
            onChange={cambiar("stock_minimo")}
          />
          <button
            type="submit"
            disabled={guardando}
            className="rounded-2xl bg-emerald-500 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:bg-gray-200 disabled:text-gray-400 sm:col-span-2 lg:col-span-1"
          >
            {guardando ? "Guardando…" : "Crear producto"}
          </button>
        </form>
      </Card>

      <Card
        titulo="Productos"
        extra={
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-600">
            <input
              type="checkbox"
              checked={soloBajo}
              onChange={(e) => setSoloBajo(e.target.checked)}
              className="accent-emerald-500"
            />
            Solo stock bajo
          </label>
        }
      >
        {lista.length === 0 ? (
          <Vacio
            texto={
              soloBajo
                ? "Ningún producto está por debajo del mínimo."
                : "Aún no hay productos. Crea el primero arriba."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-gray-400">
                <tr>
                  <th className="pb-2 font-medium">Código</th>
                  <th className="pb-2 font-medium">Producto</th>
                  <th className="pb-2 font-medium">Categoría</th>
                  <th className="pb-2 font-medium">Precio</th>
                  <th className="pb-2 font-medium">Stock</th>
                  <th className="pb-2 font-medium">Mínimo</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => (
                  <tr key={p.id} className="border-t border-gray-100">
                    <td className="py-3 text-gray-500">{p.codigo}</td>
                    <td className="py-3 font-semibold">{p.nombre}</td>
                    <td className="py-3 text-gray-600">{p.categoria}</td>
                    <td className="py-3">{money(p.precio)}</td>
                    <td className="py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          p.stock <= p.stock_minimo
                            ? "bg-rose-50 text-rose-600"
                            : "bg-emerald-50 text-emerald-600"
                        }`}
                      >
                        {p.stock}
                      </span>
                    </td>
                    <td className="py-3 text-gray-500">{p.stock_minimo}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => setAEliminar(p)}
                        className="rounded-full p-2 text-rose-500 hover:bg-rose-50"
                        aria-label={`Eliminar ${p.nombre}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ModalConfirmar
        abierto={!!aEliminar}
        titulo="Eliminar producto"
        mensaje={`"${aEliminar?.nombre ?? ""}" dejará de aparecer en Ventas. El historial de movimientos se conserva.`}
        textoConfirmar="Eliminar producto"
        peligro
        onCerrar={() => setAEliminar(null)}
        onConfirmar={eliminar}
      />
    </div>
  );
}
