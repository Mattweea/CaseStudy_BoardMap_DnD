import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const defaultAllowedHosts = ['.ngrok-free.app', '.ngrok-free.dev', '.ngrok.app'];

const additionalAllowedHosts =
  ((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);

const backendPort =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    ?.BACKEND_PORT ?? '3001';

export default defineConfig({
  plugins: [react()],
  build: {
    // I due audio autorizzati viaggiano con l'app, senza URL di asset separati nel build.
    assetsInlineLimit: (file) =>
      /[\\/]src[\\/]assets[\\/]audio[\\/](combat-start-dd|turn-notice-dd)\.mp3$/.test(file) ? true : undefined,
  },
  server: {
    host: true,
    allowedHosts: [...defaultAllowedHosts, ...additionalAllowedHosts],
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    allowedHosts: [...defaultAllowedHosts, ...additionalAllowedHosts],
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
});
