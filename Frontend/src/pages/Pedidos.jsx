import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import api from "../api";
import { useEventos } from "../socket";
import { fecha } from "../utils";
import Card, { Vacio } from "../components/Card";
import Modal, { ModalConfirmar } from "../components/Modal";

const campo =
  "w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

const ESTILO = {
  SUGERIDO: "bg-amber-50 text-amber-600",
  CREADO: "bg-sky-50 text-sky-600",
  ENVIADO: "bg-violet-50 text-violet-600",
  RECIBIDO: "bg-emerald-50 text-emerald-600",
  CANCELADO: "bg-gray-100 text-gray-500",
};
const ETIQUETA = {
  SUGERIDO: "Sugerido",
  CREADO: "Creado",
  ENVIADO: "Enviado",
  RECIBIDO: "Recibido",
  CANCELADO: "Cancelado",
};

const mensajeError = (e, defecto) => e.response?.data?.error || defecto;

// Contenido del modal "Recibir mercancía"
function FormRecibir({ pedido, onConfirmar, onCerrar }) {
  const [quien, setQuien] = useState("Bodeguero");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await onConfirmar(quien.trim());
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form onSubmit={enviar}>
      <p className="text-sm text-gray-600">
        Pedido #{pedido.id} a {pedido.proveedor || "proveedor"}. Al confirmar,
        el stock de estos productos se repone en Inventario.
      </p>
      <ul className="mt-3 space-y-1 rounded-2xl bg-gray-50 p-4 text-sm">
        {pedido.items.map((i) => (
          <li key={i.id} className="flex justify-between gap-3">
            <span className="font-medium">{i.nombre}</span>
            <span className="text-gray-500">× {i.cantidad}</span>
          </li>
        ))}
      </ul>
      <label
        className="mt-4 block text-sm font-semibold text-slate-700"
        htmlFor="recibido-por"
      >
        Nombre de quien recibe
      </label>
      <input
        id="recibido-por"
        className={`${campo} mt-1`}
        value={quien}
        onChange={(e) => setQuien(e.target.value)}
        required
      />
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-full px-5 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-100"
        >
          Volver
        </button>
        <button
          type="submit"
          disabled={enviando || !quien.trim()}
          className="rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
        >
          {enviando ? "Recibiendo…" : "Confirmar recepción"}
        </button>
      </div>
    </form>
  );
}

// Una sugerencia automática: se elige proveedor y cantidad y se confirma
function Sugerencia({ pedido, proveedores, alCambiar }) {
  const item = pedido.items[0];
  const [cantidad, setCantidad] = useState(item?.cantidad ?? 1);
  const [idProveedor, setIdProveedor] = useState("");
  if (!item) return null;

  const confirmar = async () => {
    try {
      await api.post(`/compras/pedidos/${pedido.id}/confirmar`, {
        idProveedor: Number(idProveedor),
        items: [{ idProducto: item.id_producto, cantidad: Number(cantidad) }],
      });
      toast.success("Pedido creado. Ya puedes marcarlo como enviado.");
      alCambiar();
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo confirmar el pedido."));
    }
  };

  const descartar = async () => {
    try {
      await api.post(`/compras/pedidos/${pedido.id}/cancelar`);
      toast.success("Sugerencia descartada");
      alCambiar();
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo descartar la sugerencia."));
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-100 bg-amber-50/40 p-4 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-900">
          {item.nombre}
        </p>
        <p className="text-xs text-gray-500">
          Sugerencia #{pedido.id} · {fecha(pedido.creado_en)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${campo} w-24`}
          type="number"
          min="1"
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          aria-label="Cantidad a pedir"
        />
        <select
          className={`${campo} w-48`}
          value={idProveedor}
          onChange={(e) => setIdProveedor(e.target.value)}
          aria-label="Proveedor"
        >
          <option value="">Elige un proveedor</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <button
          onClick={confirmar}
          disabled={!idProveedor || Number(cantidad) < 1}
          className="rounded-full bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
        >
          Confirmar pedido
        </button>
        <button
          onClick={descartar}
          className="rounded-full px-4 py-2.5 text-xs font-bold text-gray-500 hover:bg-gray-100"
        >
          Descartar
        </button>
      </div>
    </div>
  );
}

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState(false);
  const [modal, setModal] = useState(null); // { tipo: 'recibir' | 'cancelar', pedido }

  const cargar = useCallback(async () => {
    try {
      const [pe, pr] = await Promise.all([
        api.get("/compras/pedidos"),
        api.get("/compras/proveedores"),
      ]);
      setPedidos(pe.data);
      setProveedores(pr.data);
      setError(false);
    } catch (e) {
      console.error(e);
      setError(true);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);
  useEventos(cargar);

  const accion = async (id, ruta, cuerpo, exito) => {
    try {
      await api.post(`/compras/pedidos/${id}/${ruta}`, cuerpo);
      if (exito) toast.success(exito);
      cargar();
    } catch (e) {
      toast.error(mensajeError(e, "No se pudo completar la acción."));
    }
  };

  const recibir = (p) => setModal({ tipo: "recibir", pedido: p });
  const cancelar = (p) => setModal({ tipo: "cancelar", pedido: p });

  const crearProveedor = async (e) => {
    e.preventDefault();
    try {
      await api.post("/compras/proveedores", {
        nombre: nombre.trim(),
        telefono: telefono.trim() || undefined,
      });
      toast.success(`Proveedor "${nombre.trim()}" creado`);
      setNombre("");
      setTelefono("");
      cargar();
    } catch (err) {
      toast.error(mensajeError(err, "No se pudo crear el proveedor."));
    }
  };

  const sugerencias = pedidos.filter((p) => p.estado === "SUGERIDO");
  const resto = pedidos.filter((p) => p.estado !== "SUGERIDO");

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
          No se pudo cargar Compras. Revisa que el servicio (puerto 3005) y el
          gateway estén encendidos.
        </p>
      )}

      <Card
        titulo="Sugerencias de compra"
        extra="Se crean solas cuando un producto baja de su mínimo"
      >
        {sugerencias.length === 0 ? (
          <Vacio texto="No hay sugerencias pendientes." />
        ) : (
          <div className="space-y-3">
            {proveedores.length === 0 && (
              <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Para confirmar un pedido primero crea un proveedor en el panel
                de la derecha.
              </p>
            )}
            {sugerencias.map((p) => (
              <Sugerencia
                key={p.id}
                pedido={p}
                proveedores={proveedores}
                alCambiar={cargar}
              />
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card titulo="Pedidos a proveedores" className="lg:col-span-2">
          {resto.length === 0 ? (
            <Vacio texto="Aún no hay pedidos. Confirma una sugerencia para crear el primero." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-gray-400">
                  <tr>
                    <th className="pb-2 font-medium">Pedido</th>
                    <th className="pb-2 font-medium">Proveedor</th>
                    <th className="pb-2 font-medium">Productos</th>
                    <th className="pb-2 font-medium">Estado</th>
                    <th className="pb-2 font-medium">Creado</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {resto.map((p) => (
                    <tr
                      key={p.id}
                      className="border-t border-gray-100 align-top"
                    >
                      <td className="py-3 font-semibold">#{p.id}</td>
                      <td className="py-3 text-gray-600">
                        {p.proveedor || "—"}
                      </td>
                      <td className="py-3">
                        {p.items.map((i) => (
                          <p key={i.id}>
                            {i.nombre}{" "}
                            <span className="text-gray-400">
                              × {i.cantidad}
                            </span>
                          </p>
                        ))}
                      </td>
                      <td className="py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${ESTILO[p.estado]}`}
                        >
                          {ETIQUETA[p.estado]}
                        </span>
                        {p.estado === "RECIBIDO" && p.recibido_por && (
                          <p className="mt-1 text-xs text-gray-400">
                            Recibió {p.recibido_por}
                          </p>
                        )}
                      </td>
                      <td className="py-3 text-gray-500">
                        {fecha(p.creado_en)}
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-2">
                          {p.estado === "CREADO" && (
                            <button
                              onClick={() =>
                                accion(
                                  p.id,
                                  "enviar",
                                  undefined,
                                  "Pedido marcado como enviado",
                                )
                              }
                              className="rounded-full bg-sky-50 px-4 py-2 text-xs font-bold text-sky-600 hover:bg-sky-100"
                            >
                              Marcar enviado
                            </button>
                          )}
                          {p.estado === "ENVIADO" && (
                            <button
                              onClick={() => recibir(p)}
                              className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-600"
                            >
                              Recibir mercancía
                            </button>
                          )}
                          {["CREADO", "ENVIADO"].includes(p.estado) && (
                            <button
                              onClick={() => cancelar(p)}
                              className="rounded-full px-3 py-2 text-xs font-bold text-gray-500 hover:bg-gray-100"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card titulo="Proveedores" className="h-fit">
          <form onSubmit={crearProveedor} className="space-y-3">
            <input
              className={campo}
              placeholder="Nombre del proveedor"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
            />
            <input
              className={campo}
              placeholder="Teléfono (opcional)"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
            />
            <button
              type="submit"
              className="w-full rounded-2xl bg-emerald-500 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-600"
            >
              Crear proveedor
            </button>
          </form>
          <ul className="mt-4 divide-y divide-gray-100">
            {proveedores.length === 0 && (
              <Vacio texto="Aún no hay proveedores." />
            )}
            {proveedores.map((p) => (
              <li key={p.id} className="py-3 text-sm">
                <p className="font-semibold">{p.nombre}</p>
                {p.telefono && (
                  <p className="text-xs text-gray-400">{p.telefono}</p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Modal
        abierto={modal?.tipo === "recibir"}
        titulo="Recibir mercancía"
        onCerrar={() => setModal(null)}
      >
        {modal?.tipo === "recibir" && (
          <FormRecibir
            pedido={modal.pedido}
            onCerrar={() => setModal(null)}
            // El aviso de éxito llega en vivo con el evento MercanciaRecibida
            onConfirmar={async (quien) => {
              await accion(modal.pedido.id, "recibir", { recibidoPor: quien });
              setModal(null);
            }}
          />
        )}
      </Modal>

      <ModalConfirmar
        abierto={modal?.tipo === "cancelar"}
        titulo={`Cancelar pedido #${modal?.pedido?.id ?? ""}`}
        mensaje="El pedido dejará de estar activo y no llegará mercancía por él. Esta acción no se puede deshacer."
        textoConfirmar="Cancelar pedido"
        peligro
        onCerrar={() => setModal(null)}
        onConfirmar={async () => {
          await accion(
            modal.pedido.id,
            "cancelar",
            undefined,
            "Pedido cancelado",
          );
          setModal(null);
        }}
      />
    </div>
  );
}
