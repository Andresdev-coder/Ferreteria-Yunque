import { Link } from 'react-router-dom';

// Tarjeta de resumen con degradado, como en el diseño de referencia
export default function StatCard({ titulo, valor, icono: Icono, color, detalle = [], enlace }) {
  return (
    <div className={`flex flex-col justify-between rounded-3xl bg-linear-to-br p-5 text-white shadow-lg ${color}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white/85">{titulo}</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight">{valor}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
          <Icono size={22} />
        </div>
      </div>

      <div className="mt-6 space-y-1 border-t border-white/30 pt-3 text-xs">
        {detalle.map(([etiqueta, dato]) => (
          <div key={etiqueta} className="flex justify-between gap-2">
            <span className="text-white/80">{etiqueta}</span>
            <span className="font-bold">{dato}</span>
          </div>
        ))}
        {enlace && (
          <Link to={enlace.to} className="block text-right font-bold underline-offset-2 hover:underline">
            {enlace.texto}
          </Link>
        )}
      </div>
    </div>
  );
}
