import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { KeyRound, Mail } from "lucide-react";
import api from "../api";

const campo = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export default function RecuperarContrasena({ restablecer = false }) {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault(); setError(""); setMensaje("");
    if (restablecer && password !== confirmar) return setError("Las contraseñas no coinciden.");
    setEnviando(true);
    try {
      if (restablecer) {
        await api.post("/usuarios/auth/reset-password", { token, password });
        setMensaje("Contraseña restablecida. Ya puedes iniciar sesión.");
      } else {
        const { data } = await api.post("/usuarios/auth/forgot-password", { correo });
        setMensaje(data.mensaje);
      }
    } catch (err) { setError(err.response?.data?.error || "No se pudo completar la solicitud."); }
    finally { setEnviando(false); }
  };

  return <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
    <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl shadow-slate-900/10 md:p-10">
      <Link to="/login" className="text-3xl font-extrabold tracking-tight text-slate-900">yun<span className="text-emerald-500">que</span></Link>
      <div className="mt-8 mb-5 inline-flex rounded-2xl bg-blue-50 p-3 text-blue-700">{restablecer ? <KeyRound/> : <Mail/>}</div>
      <h1 className="text-xl font-bold text-slate-900">{restablecer ? "Crea una contraseña nueva" : "Recupera tu acceso"}</h1>
      <p className="mt-2 mb-6 text-sm leading-6 text-slate-500">{restablecer ? "Elige una contraseña de al menos 8 caracteres." : "La recuperación por correo está habilitada para la cuenta Administrador. Si el correo corresponde, enviaremos un enlace."}</p>
      {mensaje ? <div className="rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">{mensaje}{restablecer && <p className="mt-3"><Link className="font-bold underline" to="/login">Ir a iniciar sesión</Link></p>}</div> : <form onSubmit={enviar} className="space-y-4">
        {restablecer ? <>{token ? <><input className={campo} type="password" minLength={8} autoComplete="new-password" placeholder="Nueva contraseña" required value={password} onChange={e=>setPassword(e.target.value)}/><input className={campo} type="password" minLength={8} autoComplete="new-password" placeholder="Confirma la contraseña" required value={confirmar} onChange={e=>setConfirmar(e.target.value)}/></> : <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800">Falta el enlace de recuperación. Solicita uno nuevo.</p>}</> : <input className={campo} type="email" autoComplete="email" placeholder="Correo electrónico" required value={correo} onChange={e=>setCorreo(e.target.value)}/>}
        {error && <p role="alert" className="text-sm font-medium text-rose-600">{error}</p>}
        {(!restablecer || token) && <button disabled={enviando} className="w-full rounded-2xl bg-blue-700 py-3.5 text-sm font-bold text-white transition hover:bg-blue-800 disabled:opacity-60">{enviando ? "Procesando…" : restablecer ? "Guardar contraseña" : "Enviar enlace"}</button>}
      </form>}
      <Link to="/login" className="mt-6 inline-block text-sm font-semibold text-slate-500 hover:text-slate-900">Volver a iniciar sesión</Link>
    </section>
  </main>;
}
