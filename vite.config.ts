import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

/*
 * Le site est servi par GitHub Pages sous https://deluixes.github.io/dofus_craft/
 * et non à la racine du domaine. Cette constante doit donc correspondre
 * EXACTEMENT au nom du dépôt, barre au début et barre à la fin.
 *
 * Renommer le dépôt casserait l'application déjà installée sur le téléphone :
 * `scope` changerait, donc ce serait une autre application aux yeux d'Android.
 */
const BASE = '/dofus_craft/'

export default defineConfig({
  base: BASE,

  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png', 'icon-512.png'],
      manifest: {
        id: BASE,
        name: 'Krosmarge — Rentabilité Dofus Touch',
        short_name: 'Krosmarge',
        description: 'Crafts, prix et registre de négoce pour Dofus Touch.',
        lang: 'fr',
        /*
         * Sans `start_url` et `scope` préfixés, l'application installée
         * ouvrirait la racine du domaine — la page 404 de GitHub — et le
         * service worker ne contrôlerait rien.
         */
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#020617',
        theme_color: '#020617',
        icons: [
          /*
           * Chemins RELATIFS, résolus contre /dofus_craft/manifest.webmanifest.
           * Un « / » initial pointerait vers la racine du domaine, les icônes
           * seraient introuvables, et Android refuserait l'installation en
           * silence — le critère « icônes 192 et 512 valides » ne serait plus
           * rempli, sans message d'erreur explicite.
           */
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Le catalogue dépasse la limite par défaut de 2 Mio.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,json,png,svg,woff2}'],
        // Hors ligne, toute navigation retombe sur l'index précaché.
        navigateFallback: `${BASE}index.html`,
        cleanupOutdatedCaches: true,
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
