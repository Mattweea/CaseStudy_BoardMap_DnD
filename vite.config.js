import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const additionalAllowedHosts = (process.env.__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);

export default defineConfig({
    plugins: [react()],
    server: {
        host: true,
        allowedHosts: additionalAllowedHosts,
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
    preview: {
        host: true,
        allowedHosts: additionalAllowedHosts,
    },
});
