import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  optimizeDeps: {
    include: [
      'apexcharts/core',
      'apexcharts/area',
      'apexcharts/donut',
      'apexcharts/features/legend',
      'apexcharts/features/annotations',
    ],
  },
  plugins: [
    vue(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      includeAssets: ['logo-lupay-green.png'],
      manifest: {
        name: 'LUPAY - Gestor Financiero',
        short_name: 'LUPAY',
        description: 'Tu gestor financiero personal',
        theme_color: '#1e3a8a',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/logo-lupay-green.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/logo-lupay-green.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/logo-lupay-green.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
})
