export default function Card({ titulo, extra, children, className = '' }) {
  return (
    <section className={`rounded-3xl bg-white p-6 shadow-sm ${className}`}>
      {(titulo || extra) && (
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-base font-bold text-slate-900">{titulo}</h2>
          {extra && <span className="text-xs text-gray-400">{extra}</span>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Vacio({ texto }) {
  return <p className="py-8 text-center text-sm text-gray-400">{texto}</p>;
}
