import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Ventas from "./pages/Ventas";
import Inventario from "./pages/Inventario";
import Pedidos from "./pages/Pedidos";
import Facturas from "./pages/Facturas";
import Configuracion from "./pages/Configuracion";
import RecuperarContrasena from "./pages/RecuperarContrasena";

// Exige haber iniciado sesión para ver el resto de la aplicación
function Protegido({ children }) {
  const { token, cargando } = useAuth();
  if (cargando)
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-gray-400">
        Cargando…
      </div>
    );
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/recuperar-contrasena" element={<RecuperarContrasena />} />
        <Route path="/restablecer-contrasena" element={<RecuperarContrasena restablecer />} />
        <Route
          element={
            <Protegido>
              <Layout />
            </Protegido>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="ventas" element={<Ventas />} />
          <Route path="inventario" element={<Inventario />} />
          <Route path="pedidos" element={<Pedidos />} />
          <Route path="facturas" element={<Facturas />} />
          <Route path="configuracion" element={<Configuracion />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
