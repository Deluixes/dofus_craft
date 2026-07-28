import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Krosmarge — Rentabilité Dofus Touch',
        short_name: 'Krosmarge',
        description: 'Classement des crafts Dofus Touch par marge nette réelle.',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#020617',
        theme_color: '#020617',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Le catalogue dépasse la limite par défaut de 2 Mio.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,json,png,svg,woff2}'],
        runtimeCaching: [
          {
            // Icônes du CDN Ankama : mises en cache à la consultation.
            // Les embarquer alourdirait le bundle de plusieurs mégaoctets.
            urlPattern: /^https:\/\/s\.ankama\.com\/.*\.png$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ankama-icons',
              expiration: { maxEntries: 3000, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
})
