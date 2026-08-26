import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// =====================================================================
//  Super admin paneli — ALOHIDA ilova (TZ 2.2).
//
//  NEGA ALOHIDA BUILD: maktab paneliga super admin kodi hech qachon
//  tushmasligi kerak. Bitta ilovada rol bo'yicha yashirish yetarli
//  emas — kod baribir brauzerga yuklanadi va uni o'qish mumkin.
//
//  PWA YO'Q: bu ilova 2-5 kishilik jamoa uchun, ish stolida ochiladi.
//  Offline ishlash ham, ekranga o'rnatish ham kerak emas. Service
//  worker esa yangilanishni kechiktiradi — platformani boshqaruvchi
//  panel har doim eng oxirgi versiyada bo'lishi kerak.
// =====================================================================

const BASE = process.env.PANEL_BASE || '/';

export default defineConfig({
  base: BASE,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          query: ['@tanstack/react-query'],
        },
      },
    },
    chunkSizeWarningLimit: 400,
  },
  server: { port: 5174, strictPort: false },
});
