import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    root: '.',
    publicDir: 'public',
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'icons/*.png'],
            manifest: {
                name: 'Musallah-E-Talaba - Community Sehri Distribution',
                short_name: 'Musallah-E-Talaba',
                description: 'Muslim student community platform for Sehri distribution during Ramadan',
                start_url: '/',
                display: 'standalone',
                background_color: '#0a0a0a',
                theme_color: '#F4C430',
                orientation: 'portrait',
                icons: [
                    { src: 'icons/icon-72x72.png', sizes: '72x72', type: 'image/png' },
                    { src: 'icons/icon-96x96.png', sizes: '96x96', type: 'image/png' },
                    { src: 'icons/icon-128x128.png', sizes: '128x128', type: 'image/png' },
                    { src: 'icons/icon-144x144.png', sizes: '144x144', type: 'image/png' },
                    { src: 'icons/icon-152x152.png', sizes: '152x152', type: 'image/png' },
                    { src: 'icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
                    { src: 'icons/icon-384x384.png', sizes: '384x384', type: 'image/png' },
                    { src: 'icons/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
                ]
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'firebase-storage',
                            expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }
                        }
                    },
                    {
                        urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'firestore-data',
                            networkTimeoutSeconds: 10
                        }
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                        handler: 'StaleWhileRevalidate',
                        options: { cacheName: 'google-fonts-stylesheets' }
                    },
                    {
                        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'google-fonts-webfonts',
                            expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 }
                        }
                    }
                ]
            }
        })
    ],
    build: {
        target: 'esnext',
        outDir: 'dist',
        minify: 'terser',
        sourcemap: false,
        rollupOptions: {
            output: {
                manualChunks: {
                    firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage'],
                    charts: ['chart.js'],
                    pdf: ['jspdf', 'jspdf-autotable'],
                    excel: ['xlsx']
                }
            }
        }
    },
    server: {
        port: 5173,
        open: true
    }
});
