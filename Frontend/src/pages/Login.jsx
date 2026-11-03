import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Boxes, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "../auth";

const campo = "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

export default function Login() {
  const { login } = useAuth();
  const navegar = useNavigate();
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault(); setError(""); setEnviando(true);
    try { await login(correo.trim(), password); navegar("/", { replace: true }); }
    catch (err) { setError(err.response?.data?.error || "No se pudo iniciar sesión."); }
    finally { setEnviando(false); }
  };

  return <main className="min-h-screen bg-slate-100 p-4 md:grid md:place-items-center md:p-8">
    <section className="mx-auto grid min-h-[min(760px,calc(100vh-4rem))] w-full max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-slate-900/15 md:grid-cols-[0.9fr_1.1fr]">
      <aside className="relative flex min-h-64 flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-950 via-blue-800 to-sky-500 p-8 text-white md:p-12">
        <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full border-[36px] border-white/10"/><div className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-cyan-300/15 blur-2xl"/>
        <div className="relative"><div className="text-3xl font-extrabold tracking-tight">yun<span className="text-emerald-300">que</span></div><div className="mt-14 inline-flex rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur"><Boxes size={32}/></div><p className="mt-6 text-xs font-bold uppercase tracking-[0.25em] text-blue-100">Ferretería Yunque</p><h1 className="mt-3 max-w-md text-3xl font-bold leading-tight md:text-4xl">Todo tu negocio, bajo control.</h1><p className="mt-4 max-w-sm text-sm leading-6 text-blue-100">Gestiona inventario, ventas y pedidos desde un solo lugar.</p></div>
        <div className="relative hidden items-center gap-2 text-xs font-medium text-blue-100 md:flex"><ShieldCheck size={16}/> Acceso seguro para tu equipo</div>
        <Sparkles className="absolute bottom-24 right-12 hidden text-white/30 md:block" size={24}/>
      </aside>
      <div className="flex items-center justify-center px-7 py-10 md:px-12 lg:px-20">
        <div className="w-full max-w-md">
          <p className="text-sm font-semibold text-blue-700">Bienvenido de nuevo</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Inicia sesión</h2><p className="mt-3 text-sm leading-6 text-slate-500">Ingresa con las credenciales que te asignó el administrador.</p>
          <form onSubmit={enviar} className="mt-9 space-y-5">
            <label className="block text-sm font-semibold text-slate-700">Correo electrónico<input className={`${campo} mt-2`} type="email" placeholder="nombre@empresa.com" value={correo} onChange={e=>setCorreo(e.target.value)} autoComplete="username" autoFocus required/></label>
            <label className="block text-sm font-semibold text-slate-700">Contraseña<input className={`${campo} mt-2`} type="password" placeholder="Tu contraseña" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></label>
            <div className="flex justify-end"><Link to="/recuperar-contrasena" className="text-sm font-semibold text-blue-700 hover:text-blue-900">¿Olvidaste tu contraseña? (Administrador)</Link></div>
            {error && <p role="alert" className="text-sm font-medium text-rose-600">{error}</p>}
            <button type="submit" disabled={enviando} className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 py-4 text-sm font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">{enviando ? "Ingresando…" : "Ingresar"}<ArrowRight size={17} className="transition group-hover:translate-x-1"/></button>
          </form>
          <p className="mt-8 text-center text-xs leading-5 text-slate-400">¿Necesitas acceso? Solicítalo al administrador de tu sistema.</p>
        </div>
      </div>
    </section>
  </main>;
}
