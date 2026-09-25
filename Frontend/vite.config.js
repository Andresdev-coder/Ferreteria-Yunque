import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// strictPort: si el 5173 está ocupado falla en vez de cambiar de puerto,
// porque el gateway solo acepta peticiones desde http://localhost:5173
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true },
});
