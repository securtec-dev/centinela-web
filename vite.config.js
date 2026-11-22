import { defineConfig } from 'vite';

const origin = process.env.CENTINELA_WEB_API ?? 'http://127.0.0.1:8080';
export default defineConfig({ server: { proxy: { '/api': { target: origin } } } });
