import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL } from './api';

// Una sola conexión para toda la aplicación
export const socket = io(API_URL);

// Ejecuta "callback" cuando llega cualquier evento del negocio.
// Espera un instante para agrupar ráfagas (una venta genera varios eventos).
export function useEventos(callback) {
  const ref = useRef(callback);
  ref.current = callback;

  useEffect(() => {
    let t;
    const handler = () => {
      clearTimeout(t);
      t = setTimeout(() => ref.current(), 400);
    };
    socket.on('evento', handler);
    return () => {
      clearTimeout(t);
      socket.off('evento', handler);
    };
  }, []);
}

export function useConectado() {
  const [ok, setOk] = useState(socket.connected);
  useEffect(() => {
    const on = () => setOk(true);
    const off = () => setOk(false);
    socket.on('connect', on);
    socket.on('disconnect', off);
    setOk(socket.connected); 
    return () => {
      socket.off('connect', on);
      socket.off('disconnect', off);
    };
  }, []);
  return ok;
}
