var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var _a, _b, _c;
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
var defaultAllowedHosts = ['.ngrok-free.dev', '.ngrok.app'];
var additionalAllowedHosts = ((_c = (_b = (_a = globalThis.process) === null || _a === void 0 ? void 0 : _a.env) === null || _b === void 0 ? void 0 : _b.__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS) !== null && _c !== void 0 ? _c : '')
    .split(',')
    .map(function (host) { return host.trim(); })
    .filter(Boolean);
export default defineConfig({
    plugins: [react()],
    server: {
        host: true,
        allowedHosts: __spreadArray(__spreadArray([], defaultAllowedHosts, true), additionalAllowedHosts, true),
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
    preview: {
        host: true,
        allowedHosts: __spreadArray(__spreadArray([], defaultAllowedHosts, true), additionalAllowedHosts, true),
    },
});
