import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Boxes, TriangleAlert, Truck, Wallet } from "lucide-react";
import api from "../api";
import { useEventos } from "../socket";
import { fecha, money } from "../utils";
import Card, { Vacio } from "../components/Card";
import StatCard from "../components/StatCard";

const COLORES = [
  "#F97316",
  "#10B981",
  "#0EA5E9",
  "#8B5CF6",
  "#F43F5E",
  "#EAB308",
];

// Fecha local en formato AAAA-MM-DD (para agrupar por día)
const dia = (d) => new Date(d).toLocaleDateString("en-CA");

export default function Dashboard() {
  const [ventas, setVentas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [ventasCategoria, setVentasCategoria] = useState([]);
  const [topProductos, setTopProductos] = useState([]);
  const [stockBajo, setStockBajo] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [error, setError] = useState(false);

  const cargar = useCallback(async () => {
    // Cada servicio responde por su cuenta: si uno está caído, el resto del panel sigue funcionando
    const pedir = (url) =>
      api
        .get(url)
        .then((r) => r.data)
        .catch(() => null);
    const [v, p, s, pe, vc, tp] = await Promise.all([
      pedir("/ventas/ventas"),
      pedir("/inventario/productos"),
      pedir("/inventario/productos/stock-bajo"),
      pedir("/compras/pedidos"),
      pedir("/reportes/ventas-por-categoria"),
      pedir("/reportes/productos-mas-vendidos?limit=6"),
    ]);
    if (v) setVentas(v);
    if (p) setProductos(p);
    if (s) setStockBajo(s);
    if (pe) setPedidos(pe);
    if (vc) setVentasCategoria(vc);
    if (tp) setTopProductos(tp);
    setError(!v && !p && !s && !pe);
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);
  useEventos(cargar);

  const confirmadas = useMemo(
    () => ventas.filter((v) => v.estado === "CONFIRMADA"),
    [ventas],
  );

  const hoy = dia(new Date());
  const ventasHoy = confirmadas.filter((v) => dia(v.creado_en) === hoy);
  const totalHoy = ventasHoy.reduce((s, v) => s + Number(v.total), 0);
  const totalMes = confirmadas
    .filter((v) => dia(v.creado_en).startsWith(hoy.slice(0, 7)))
    .reduce((s, v) => s + Number(v.total), 0);

  // Ventas de los últimos 14 días para la gráfica de área
  const serie = useMemo(() => {
    const dias = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dias.push({
        key: dia(d),
        etiqueta: d.toLocaleDateString("es-CO", {
          day: "2-digit",
          month: "short",
        }),
        total: 0,
      });
    }
    const porClave = new Map(dias.map((x) => [x.key, x]));
    confirmadas.forEach((v) => {
      const x = porClave.get(dia(v.creado_en));
      if (x) x.total += Number(v.total);
    });
    return dias;
  }, [confirmadas]);

  // Ventas por categoría (para la dona), calculadas por el servicio de Reportes
  const porCategoria = useMemo(
    () =>
      ventasCategoria.map((c) => ({
        name: c.categoria,
        value: Number(c.total),
      })),
    [ventasCategoria],
  );
  const totalVendidoCategorias = porCategoria.reduce((s, c) => s + c.value, 0);
  const totalUnidades = productos.reduce((s, p) => s + p.stock, 0);
  const abiertos = pedidos.filter((x) =>
    ["SUGERIDO", "CREADO", "ENVIADO"].includes(x.estado),
  );

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
          No se pudo cargar la información. Revisa que el gateway (puerto 3000)
          y los servicios estén encendidos.
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          titulo="Ventas de hoy"
          valor={money(totalHoy)}
          icono={Wallet}
          color="from-emerald-500 to-green-600"
          detalle={[
            ["Ventas registradas", ventasHoy.length],
            ["Acumulado del mes", money(totalMes)],
          ]}
        />
        <StatCard
          titulo="Productos"
          valor={productos.length}
          icono={Boxes}
          color="from-sky-500 to-blue-600"
          detalle={[
            ["Unidades en stock", totalUnidades],
            ["Categorías", porCategoria.length],
          ]}
        />
        <StatCard
          titulo="Pedidos en curso"
          valor={abiertos.length}
          icono={Truck}
          color="from-violet-500 to-purple-600"
          detalle={[
            [
              "Sugerencias por revisar",
              pedidos.filter((x) => x.estado === "SUGERIDO").length,
            ],
            ["En camino", pedidos.filter((x) => x.estado === "ENVIADO").length],
          ]}
          enlace={{ to: "/pedidos", texto: "Ver pedidos" }}
        />
        <StatCard
          titulo="Stock bajo"
          valor={stockBajo.length}
          icono={TriangleAlert}
          color="from-orange-500 to-red-500"
          detalle={[["Productos por reponer", stockBajo.length]]}
          enlace={{ to: "/inventario?bajo=1", texto: "Ver detalles" }}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card
          titulo="Ventas de los últimos 14 días"
          extra="Total vendido por día"
          className="lg:col-span-2"
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={serie}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="relleno" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="4 4"
                  vertical={false}
                  stroke="#E5E7EB"
                />
                <XAxis
                  dataKey="etiqueta"
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  interval={1}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  width={56}
                  tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                />
                <Tooltip formatter={(v) => [money(v), "Ventas"]} />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#10B981"
                  strokeWidth={3}
                  fill="url(#relleno)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card titulo="Ventas por categoría" extra="Total vendido por categoría">
          {porCategoria.length === 0 ? (
            <Vacio texto="Aún no hay ventas registradas por categoría." />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="h-44 w-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={porCategoria}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {porCategoria.map((c, i) => (
                        <Cell key={c.name} fill={COLORES[i % COLORES.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [money(v), n]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full space-y-2 text-sm">
                {porCategoria.map((c, i) => (
                  <li
                    key={c.name}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="flex items-center gap-2 text-gray-600">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: COLORES[i % COLORES.length] }}
                      />
                      {c.name}
                    </span>
                    <span className="font-semibold">
                      {Math.round((c.value * 100) / totalVendidoCategorias)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <Card titulo="Productos más vendidos" extra="Unidades vendidas en total">
        {topProductos.length === 0 ? (
          <Vacio texto="Aún no hay suficientes ventas para calcular un ranking." />
        ) : (
          <div className="space-y-3">
            {topProductos.map((p, i) => {
              const max = topProductos[0].unidades_vendidas || 1;
              return (
                <div key={p.id_producto} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate text-sm font-medium text-slate-700">
                    {p.nombre}
                  </span>
                  <div className="h-2.5 flex-1 rounded-full bg-gray-100">
                    <div
                      className="h-2.5 rounded-full bg-emerald-500"
                      style={{
                        width: `${Math.max((p.unidades_vendidas / max) * 100, 4)}%`,
                      }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-sm font-bold text-slate-900">
                    {p.unidades_vendidas} und.
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card titulo="Últimas ventas" className="lg:col-span-2">
          {ventas.length === 0 ? (
            <Vacio texto="Todavía no hay ventas. Registra la primera en Ventas." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-gray-400">
                  <tr>
                    <th className="pb-2 font-medium">Venta</th>
                    <th className="pb-2 font-medium">Cliente</th>
                    <th className="pb-2 font-medium">Total</th>
                    <th className="pb-2 font-medium">Factura</th>
                    <th className="pb-2 font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {ventas.slice(0, 6).map((v) => (
                    <tr key={v.id} className="border-t border-gray-100">
                      <td className="py-3 font-semibold">#{v.id}</td>
                      <td className="py-3 text-gray-600">
                        {v.cliente || "Cliente general"}
                      </td>
                      <td className="py-3 font-semibold">{money(v.total)}</td>
                      <td className="py-3">
                        {v.estado === "RECHAZADA" ? (
                          <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
                            Rechazada
                          </span>
                        ) : v.factura_numero ? (
                          <span className="text-xs font-semibold text-emerald-600">
                            {v.factura_numero}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-gray-500">
                        {fecha(v.creado_en)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card titulo="Stock crítico" extra="Por debajo del mínimo">
          {stockBajo.length === 0 ? (
            <Vacio texto="Todo el inventario está por encima del mínimo." />
          ) : (
            <ul className="space-y-3">
              {stockBajo.slice(0, 6).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="truncate font-medium text-slate-800">
                    {p.nombre}
                  </span>
                  <span className="shrink-0 rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-600">
                    {p.stock} / {p.stock_minimo}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
