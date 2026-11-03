import { useCallback, useEffect, useState } from "react";
import { KeyRound, UserPlus, Users } from "lucide-react";
import { toast } from "react-hot-toast";
import api from "../api";
import { useAuth } from "../auth";

const ROLES = ["ADMINISTRADOR", "VENDEDOR", "BODEGUERO"];
const etiquetaRol = { ADMINISTRADOR: "Administrador", VENDEDOR: "Vendedor", BODEGUERO: "Bodeguero" };
const campo = "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

export default function Configuracion() {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === "ADMINISTRADOR";
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [guardandoClave, setGuardandoClave] = useState(false);
  const [guardandoUsuario, setGuardandoUsuario] = useState(false);
  const [clave, setClave] = useState({ actual: "", nueva: "", confirmar: "" });
  const [nuevo, setNuevo] = useState({ nombre: "", correo: "", password: "", rol: "VENDEDOR" });

  const cargarUsuarios = useCallback(async () => {
    if (!esAdmin) return;
    setCargando(true);
    try { setUsuarios((await api.get("/usuarios/usuarios")).data); }
    catch (error) { toast.error(error.response?.data?.error || "No se pudieron cargar las cuentas."); }
    finally { setCargando(false); }
  }, [esAdmin]);
  useEffect(() => { cargarUsuarios(); }, [cargarUsuarios]);

  const cambiarClave = async (e) => {
    e.preventDefault();
    if (clave.nueva !== clave.confirmar) return toast.error("Las contraseñas nuevas no coinciden.");
    setGuardandoClave(true);
    try {
      await api.post("/usuarios/auth/change-password", { actual: clave.actual, nueva: clave.nueva });
      toast.success("Contraseña actualizada."); setClave({ actual: "", nueva: "", confirmar: "" });
    } catch (error) { toast.error(error.response?.data?.error || "No se pudo actualizar la contraseña."); }
    finally { setGuardandoClave(false); }
  };

  const crearUsuario = async (e) => {
    e.preventDefault(); setGuardandoUsuario(true);
    try {
      await api.post("/usuarios/usuarios", nuevo);
      toast.success("Perfil creado."); setNuevo({ nombre: "", correo: "", password: "", rol: "VENDEDOR" }); await cargarUsuarios();
    } catch (error) { toast.error(error.response?.data?.error || "No se pudo crear el perfil."); }
    finally { setGuardandoUsuario(false); }
  };

  const desactivar = async (id) => {
    if (!window.confirm("¿Desactivar esta cuenta? Ya no podrá iniciar sesión.")) return;
    try { await api.delete(`/usuarios/usuarios/${id}`); toast.success("Cuenta desactivada."); await cargarUsuarios(); }
    catch (error) { toast.error(error.response?.data?.error || "No se pudo desactivar la cuenta."); }
  };

  return <div className="mx-auto max-w-5xl space-y-8">
    <div><p className="text-sm font-semibold text-emerald-600">Cuenta y acceso</p><h2 className="mt-1 text-2xl font-bold text-slate-900">Configuración</h2><p className="mt-2 text-sm text-slate-500">Administra tu contraseña{esAdmin ? " y los perfiles del equipo" : " personal"}.</p></div>
    <section className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
      <div className="mb-6 flex items-center gap-3"><span className="rounded-2xl bg-emerald-50 p-3 text-emerald-600"><KeyRound size={20}/></span><div><h3 className="font-bold text-slate-900">Cambiar mi contraseña</h3><p className="text-sm text-slate-500">Usa al menos 8 caracteres.</p></div></div>
      <form onSubmit={cambiarClave} className="grid gap-4 md:grid-cols-3">
        <label className="text-sm font-medium text-slate-600">Contraseña actual<input className={`${campo} mt-2`} type="password" autoComplete="current-password" required value={clave.actual} onChange={e=>setClave({...clave,actual:e.target.value})}/></label>
        <label className="text-sm font-medium text-slate-600">Nueva contraseña<input className={`${campo} mt-2`} type="password" minLength={8} autoComplete="new-password" required value={clave.nueva} onChange={e=>setClave({...clave,nueva:e.target.value})}/></label>
        <label className="text-sm font-medium text-slate-600">Confirmar contraseña<input className={`${campo} mt-2`} type="password" minLength={8} autoComplete="new-password" required value={clave.confirmar} onChange={e=>setClave({...clave,confirmar:e.target.value})}/></label>
        <div className="md:col-span-3"><button disabled={guardandoClave} className="rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-600 disabled:opacity-60">{guardandoClave ? "Guardando…" : "Actualizar contraseña"}</button></div>
      </form>
    </section>
    {esAdmin && <>
      <section className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
        <div className="mb-6 flex items-center gap-3"><span className="rounded-2xl bg-blue-50 p-3 text-blue-700"><UserPlus size={20}/></span><div><h3 className="font-bold text-slate-900">Crear perfil</h3><p className="text-sm text-slate-500">Crea una cuenta y asigna sus permisos.</p></div></div>
        <form onSubmit={crearUsuario} className="grid gap-4 md:grid-cols-2">
          <label className="text-sm font-medium text-slate-600">Nombre<input className={`${campo} mt-2`} required maxLength={120} value={nuevo.nombre} onChange={e=>setNuevo({...nuevo,nombre:e.target.value})}/></label>
          <label className="text-sm font-medium text-slate-600">Correo<input className={`${campo} mt-2`} type="email" required value={nuevo.correo} onChange={e=>setNuevo({...nuevo,correo:e.target.value})}/></label>
          <label className="text-sm font-medium text-slate-600">Contraseña inicial<input className={`${campo} mt-2`} type="password" required minLength={8} autoComplete="new-password" value={nuevo.password} onChange={e=>setNuevo({...nuevo,password:e.target.value})}/></label>
          <label className="text-sm font-medium text-slate-600">Rol<select className={`${campo} mt-2`} value={nuevo.rol} onChange={e=>setNuevo({...nuevo,rol:e.target.value})}>{ROLES.map(rol=><option key={rol} value={rol}>{etiquetaRol[rol]}</option>)}</select></label>
          <div className="md:col-span-2"><button disabled={guardandoUsuario} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-700 disabled:opacity-60">{guardandoUsuario ? "Creando…" : "Crear cuenta"}</button></div>
        </form>
      </section>
      <section className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
        <div className="mb-5 flex items-center gap-3"><Users className="text-slate-500" size={20}/><div><h3 className="font-bold text-slate-900">Perfiles del equipo</h3><p className="text-sm text-slate-500">Las cuentas desactivadas conservan su historial.</p></div></div>
        {cargando ? <p className="text-sm text-slate-500">Cargando perfiles…</p> : <div className="divide-y divide-slate-100">{usuarios.map(u=><div key={u.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-semibold text-slate-800">{u.nombre} <span className="ml-2 text-xs font-medium text-slate-400">{etiquetaRol[u.rol] || u.rol}</span></p><p className="text-sm text-slate-500">{u.correo}</p></div><div className="flex items-center gap-3">{Number(u.activo) ? <span className="text-xs font-semibold text-emerald-600">Activo</span> : <span className="text-xs font-semibold text-slate-400">Inactivo</span>}{Number(u.activo) === 1 && u.id !== usuario?.sub && <button onClick={()=>desactivar(u.id)} className="text-sm font-semibold text-rose-600 hover:text-rose-700">Desactivar</button>}</div></div>)}</div>}
      </section>
    </>}
  </div>;
}
