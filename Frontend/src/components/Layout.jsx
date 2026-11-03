import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import {
  Hand,
  LayoutDashboard,
  LogOut,
  Settings,
  Package,
  PackageCheck,
  Receipt,
  ShoppingCart,
  Truck,
  TriangleAlert,
  Wifi,
  WifiOff,
} from "lucide-react";
import { socket, useConectado } from "../socket";
import { useAuth } from "../auth";
import { money } from "../utils";

const ETIQUETA_ROL = {
  ADMINISTRADOR: "Administrador",
  VENDEDOR: "Vendedor",
  BODEGUERO: "Bodeguero",
};

const NAV = [
  { to: "/", label: "Dashboard", icono: LayoutDashboard, end: true },
  { to: "/ventas", label: "Ventas", icono: ShoppingCart },
  { to: "/inventario", label: "Inventario", icono: Package },
  { to: "/pedidos", label: "Pedidos", icono: Truck },
  { to: "/facturas", label: "Facturas", icono: Receipt },
  { to: "/configuracion", label: "Configuración", icono: Settings },
];

function saludo() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

// Convierte los eventos del negocio en avisos en pantalla
function avisar(evento) {
  const d = evento.data;
  switch (evento.type) {
    case 'StockBajoMinimo':
      toast.error(`Stock bajo: ${d.nombre} (${d.stockActual} und., mínimo ${d.stockMinimo})`, {
        duration: 8000,
        icon: <TriangleAlert size={18} className="text-rose-500" />,
      });
      break;
    case 'VentaConfirmada':
      toast.success(`Venta #${d.idVenta} confirmada por ${money(d.total)}`);
      break;
    case 'FacturaGenerada':
      toast.success(`Factura ${d.numero} generada`, {
        icon: <Receipt size={18} className="text-emerald-500" />,
      });
      break;
    case 'PedidoSugerido':
      toast(`Sugerencia de compra: ${d.nombre} (${d.cantidadSugerida} und.)`, {
        duration: 6000,
        icon: <ShoppingCart size={18} className="text-amber-500" />,
      });
      break;
    case 'MercanciaRecibida':
      toast.success(`Mercancía del pedido #${d.idPedido} recibida. El stock se repuso.`, {
        duration: 6000,
        icon: <PackageCheck size={18} className="text-emerald-500" />,
      });
      break;
    case 'StockInsuficiente':
      toast.error(`Venta #${d.idVenta} rechazada: no hay stock suficiente`, { duration: 6000 });
      break;
    default:
      break;
  }
}

function claseEnlace({ isActive }) {
  return [
    "flex items-center gap-3 border-l-[3px] px-8 py-3 text-sm font-semibold transition-colors",
    isActive
      ? "border-emerald-500 bg-emerald-50/60 text-emerald-600"
      : "border-transparent text-gray-500 hover:text-slate-900",
  ].join(" ");
}

export default function Layout() {
  const conectado = useConectado();
  const { usuario, logout } = useAuth();
  const navegar = useNavigate();

  const salir = () => {
    logout();
    navegar("/login", { replace: true });
  };

  useEffect(() => {
    socket.on("evento", avisar);
    return () => socket.off("evento", avisar);
  }, []);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col bg-white py-8 md:flex">
        <div className="mb-10 px-8 text-3xl font-extrabold tracking-tight text-slate-900">
          yun<span className="text-emerald-500">que</span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map(({ to, label, icono: Icono, end }) => (
            <NavLink key={to} to={to} end={end} className={claseEnlace}>
              <Icono size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Navegación para pantallas pequeñas */}
        <nav className="flex gap-1 overflow-x-auto bg-white px-3 py-2 md:hidden">
          {NAV.map(({ to, label, icono: Icono, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                  isActive ? "bg-emerald-50 text-emerald-600" : "text-gray-500"
                }`
              }
            >
              <Icono size={17} />
              {label}
            </NavLink>
          ))}
        </nav>

        <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-6 md:px-10">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            {saludo()}, {usuario?.nombre ?? "Administrador"}
            <Hand size={20} className="icono-saludo text-amber-500" />
          </h1>
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ${
                conectado
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-rose-50 text-rose-600"
              }`}
            >
              {conectado ? <Wifi size={15} /> : <WifiOff size={15} />}
              {conectado ? "Alertas en vivo" : "Sin conexión con el gateway"}
            </div>
            {usuario && (
              <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-gray-500 shadow-sm">
                {ETIQUETA_ROL[usuario.rol] ?? usuario.rol}
                <button
                  onClick={salir}
                  className="flex items-center gap-1 text-rose-500 hover:text-rose-600"
                  aria-label="Cerrar sesión"
                >
                  <LogOut size={14} />
                  Salir
                </button>
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 px-6 pb-10 md:px-10">
          <Outlet />
        </main>
      </div>

      <Toaster
        position="top-right"
        toastOptions={{ style: { borderRadius: "16px", fontWeight: 600 } }}
      />
    </div>
  );
}
