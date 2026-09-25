import { useEffect, useId, useRef, useState } from "react";

// Modal basado en <dialog>: el navegador se encarga del foco, de Esc
// y de bloquear el resto de la pantalla mientras está abierto.
export default function Modal({
  abierto,
  titulo,
  onCerrar,
  children,
  ancho = "max-w-md",
}) {
  const ref = useRef(null);
  const idTitulo = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={idTitulo}
      onClose={onCerrar}
      // Clic sobre el fondo oscuro: cierra
      onClick={(e) => {
        if (e.target === ref.current) onCerrar();
      }}
      className={`m-auto w-[calc(100%-2rem)] ${ancho} rounded-3xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm`}
    >
      {abierto && (
        <div className="p-6">
          <h2 id={idTitulo} className="mb-4 text-lg font-bold">
            {titulo}
          </h2>
          {children}
        </div>
      )}
    </dialog>
  );
}

// Modal de confirmación para acciones que no se pueden deshacer
export function ModalConfirmar({
  abierto,
  titulo,
  mensaje,
  textoConfirmar,
  peligro = false,
  onConfirmar,
  onCerrar,
}) {
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    setEnviando(true);
    try {
      await onConfirmar();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal abierto={abierto} titulo={titulo} onCerrar={onCerrar}>
      <p className="text-sm leading-relaxed text-gray-600">{mensaje}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button
          onClick={onCerrar}
          className="rounded-full px-5 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-100"
        >
          Volver
        </button>
        <button
          onClick={confirmar}
          disabled={enviando}
          className={`rounded-full px-5 py-2.5 text-sm font-bold text-white transition disabled:opacity-60 ${
            peligro
              ? "bg-rose-500 hover:bg-rose-600"
              : "bg-emerald-500 hover:bg-emerald-600"
          }`}
        >
          {enviando ? "Un momento…" : textoConfirmar}
        </button>
      </div>
    </Modal>
  );
}
