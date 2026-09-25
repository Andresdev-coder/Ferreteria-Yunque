import { createContext, useContext, useEffect, useState } from "react";
import api from "./api";

const CLAVE_TOKEN = "yunque_token";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(CLAVE_TOKEN));
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Al recargar la página, si hay un token guardado se restaura la sesión
  useEffect(() => {
    if (!token) {
      setCargando(false);
      return;
    }
    api
      .get("/usuarios/auth/me")
      .then(({ data }) => setUsuario(data))
      .catch(() => {
        localStorage.removeItem(CLAVE_TOKEN);
        setToken(null);
      })
      .finally(() => setCargando(false));
  }, [token]);

  const login = async (correo, password) => {
    const { data } = await api.post("/usuarios/auth/login", {
      correo,
      password,
    });
    localStorage.setItem(CLAVE_TOKEN, data.token);
    setToken(data.token);
    setUsuario(data.usuario);
  };

  const logout = () => {
    localStorage.removeItem(CLAVE_TOKEN);
    setToken(null);
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ token, usuario, cargando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
