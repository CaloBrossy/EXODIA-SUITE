/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins:
    mode === 'test'
      ? []
      : [
          react(),
          tailwindcss(),
          VitePWA({
            registerType: 'prompt',
            injectRegister: false,
            includeAssets: ['favicon.svg'],
            manifest: {
              name: 'EXODIA — Knowledge & Science Lab',
              short_name: 'EXODIA',
              description: 'Laboratorio personal de conocimiento, ciencia, matemática y productividad.',
              lang: 'es',
              start_url: '/',
              scope: '/',
              display: 'standalone',
              background_color: '#111113',
              theme_color: '#111113',
              icons: [
                { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,svg,png,woff2,woff,ttf,webmanifest}'],
              maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
              navigateFallback: 'index.html',
              cleanupOutdatedCaches: true,
            },
            devOptions: { enabled: false },
          }),
        ],
  build: { chunkSizeWarningLimit: 800 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
  },
}))
