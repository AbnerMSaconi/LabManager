import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '');
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        // 1. Proxy reverso para o Keycloak (Engana o navegador e resolve o CORS)
        '/keycloak': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/keycloak/, '')
        },
        
        // 2. Rota de Auth apontando para o C# no Docker (Porta 8001 corrigida)
        '/api/v1/auth/sync': {
          target: 'http://localhost:8001', 
          changeOrigin: true,
        },
        
        // 3. Demais rotas /api/* para o FastAPI em :8000
        '/api': {
          target: env.VITE_API_BASE_URL ?? 'http://localhost:8001',
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
                proxyRes.headers['cache-control'] = 'no-cache';
                proxyRes.headers['x-accel-buffering'] = 'no';
              }
            });
          },
        },
      },
    },
  };
});