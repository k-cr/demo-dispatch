import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Lee también el .env de la raíz del proyecto
  const env = { ...loadEnv(mode, '..', ''), ...loadEnv(mode, '.', '') };
  return {
    plugins: [react()],
    envDir: '..',
    server: {
      port: 5173,
      proxy: {
        '/api': { target: env.API_PROXY_TARGET || `http://localhost:${env.PORT || 4000}`, changeOrigin: true },
      },
    },
  };
});
