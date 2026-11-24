// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'node:url';
export default defineNuxtConfig({
  devtools: { enabled: true },
  ssr: false,
  app: {
    head: {
      link: [
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&display=swap',
        },
      ],
    },
  },
  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
    'nuxt-vuefire',
    '@pinia/nuxt',
    '@nuxtjs/i18n'
  ],
  i18n: {
    locales: [
      { code: 'en', file: 'en.json', name: 'English' },
      { code: 'fr', file: 'fr.json', name: 'Français' },
      { code: 'ar', file: 'ar.json', name: 'العربية', dir: 'rtl' }
    ],
    lazy: true,
    langDir: 'locales',
    defaultLocale: 'fr',
    strategy: 'no_prefix',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      redirectOn: 'root',
    }
  },
  colorMode: {
    preference: 'system',
    fallback: 'light'
  },
  vuefire: {
    auth: {
      enabled: true,
    },
    config: {
      apiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID,
    },
  },

  runtimeConfig: {
    // ✅ No more private Admin SDK keys — backend logic lives in Cloud Functions
    public: {
      firebaseApiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID,
      firebase: {
        firestore: {
          enable: true,
        },
        functions: {
          enable: true,
          location: 'europe-west3',
          enableEmulator: process.env.NODE_ENV !== 'production',
          emulatorPort: 5001,
          emulatorHost: '127.0.0.1',
        },
        analytics: {
          enable: ['production', 'staging'].includes(process.env.ENVIRONMENT!),
        },
        storage: {
          enable: true,
          location: 'europe-west3',
          enableEmulator: process.env.NODE_ENV !== 'production',
          emulatorPort: 9199,
          emulatorHost: '127.0.0.1',
        },
      },
    },
  },

  css: ['~/assets/css/main.css'],
  compatibilityDate: '2025-07-16',
  vite: {
    optimizeDeps: {
      include: [
        'vuefire',
      ]
    }
  },
   spaLoadingTemplate: fileURLToPath(new URL('./spa-loading-template.html', import.meta.url)), 
})