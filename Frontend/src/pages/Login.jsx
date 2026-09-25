import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

const campo =
  "w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

export default function Login() {
  const { login } = useAuth();
  const navegar = useNavigate();
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError("");
    setEnviando(true);
    try {
      await login(correo.trim(), password);
      navegar("/", { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || "No se pudo iniciar sesión.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-sm">
        <div className="mb-6 text-3xl font-extrabold tracking-tight text-slate-900">
          yun<span className="text-emerald-500">que</span>
        </div>
        <h1 className="mb-1 text-lg font-bold text-slate-900">Inicia sesión</h1>
        <p className="mb-6 text-sm text-gray-500">
          Ingresa con tu correo y contraseña.
        </p>

        <form onSubmit={enviar} className="space-y-3">
          <input
            className={campo}
            type="email"
            placeholder="Correo"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            autoFocus
            required
          />
          <input
            className={campo}
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && (
            <p className="text-sm font-medium text-rose-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-2xl bg-emerald-500 py-3 text-sm font-bold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
