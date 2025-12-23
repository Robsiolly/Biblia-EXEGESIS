
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Permite que process.env.API_KEY seja lido dinamicamente se disponível,
    // caso contrário o serviço usará seu próprio fallback.
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
