import { useCallback, useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../api";
import { useEventos } from "../socket";
import { fecha, money } from "../utils";
import Card, { Vacio } from "../components/Card";

export default function Facturas() {
  const [facturas, setFacturas] = useState([]);

  const cargar = useCallback(async () => {
    try {
      const { data } = await api.get("/facturacion/facturas");
      setFacturas(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);
  useEventos(cargar);

  const verPdf = async (id) => {
    try {
      const { data } = await api.get(`/facturacion/facturas/${id}/pdf`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(data);
      window.open(url, "_blank");
    } catch {
      toast.error("No se pudo abrir el PDF.");
    }
  };

  return (
    <Card titulo="Facturas emitidas">
      {facturas.length === 0 ? (
        <Vacio texto="Aún no hay facturas. Se generan solas al confirmar una venta." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-gray-400">
              <tr>
                <th className="pb-2 font-medium">Factura</th>
                <th className="pb-2 font-medium">Venta</th>
                <th className="pb-2 font-medium">Cliente</th>
                <th className="pb-2 font-medium">Total</th>
                <th className="pb-2 font-medium">Emitida</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {facturas.map((f) => (
                <tr key={f.id} className="border-t border-gray-100">
                  <td className="py-3 font-semibold text-emerald-600">
                    {f.numero}
                  </td>
                  <td className="py-3">#{f.id_venta}</td>
                  <td className="py-3 text-gray-600">
                    {f.cliente || "Cliente general"}
                  </td>
                  <td className="py-3 font-semibold">{money(f.total)}</td>
                  <td className="py-3 text-gray-500">{fecha(f.emitida_en)}</td>
                  <td className="py-3 text-right">
                    <button
                      onClick={() => verPdf(f.id)}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-100"
                    >
                      <FileText size={15} />
                      Ver PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
