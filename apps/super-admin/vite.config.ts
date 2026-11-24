import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

// =====================================================================
//  Super admin paneli — ALOHIDA ilova (TZ 2.2).
//
//  NEGA ALOHIDA BUILD: maktab paneliga super admin kodi hech qachon
//  tushmasligi kerak. Bitta ilovada rol bo'yicha yashirish yetarli
//  emas — kod baribir brauzerga yuklanadi va uni o'qish mumkin.
//
//  PWA: ilovani kompyuter yoki telefonga O'RNATISH mumkin (alohida
//  oyna, belgisi bilan). Yangilanish kechikmasin: yangi versiya
//  chiqqanda o'zi yangilanadi (main.tsx), keshda API so'rovlari yo'q.
// =====================================================================

const BASE = process.env.PANEL_BASE || '/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'logo-mark.svg'],
      workbox: {
        navigateFallbackDenylist: [/^\/rest\//, /^\/auth\//, /^\/storage\//, /^\/functions\//],
        runtimeCaching: [],
      },
      manifest: {
        id: 'uztomic-edu-admin',
        name: 'Uztomic Edu — Platforma',
        short_name: 'Edu Admin',
        description: 'Uztomic Edu platforma boshqaruvi',
        lang: 'uz',
        theme_color: '#0B0D11',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: BASE,
        scope: BASE,
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
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
