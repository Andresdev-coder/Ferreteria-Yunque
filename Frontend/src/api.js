import axios from 'axios';

// Todo el frontend habla solo con el gateway
const configuredApiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
export const API_URL = configuredApiUrl.replace(/\/+$/, '');
const CLAVE_TOKEN = 'yunque_token';

const api = axios.create({ baseURL: `${API_URL}/api` });

// Adjunta el token de sesión a cada petición, sin tener que pasarlo a mano
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(CLAVE_TOKEN);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Si el gateway responde 401 (sesión vencida o inválida), se cierra sesión sola
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(CLAVE_TOKEN);
      if (!location.pathname.startsWith('/login')) location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
