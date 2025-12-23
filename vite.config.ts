
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Injeta a API_KEY do ambiente ou mantém nulo para o fallback interno do geminiService lidar
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || ''),
  },
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: './index.html',
      },
    },
  },
  server: {
    port: 3000,
  },
});
