// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
    'nuxt-vuefire',
    '@pinia/nuxt',
  ],

  vuefire: {
    auth: {
      enabled: true,
      sessionCookie: false,
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
    // Private — server only
    firebaseAdminProjectId: process.env.NUXT_FIREBASE_ADMIN_PROJECT_ID,
    firebaseAdminClientEmail: process.env.NUXT_FIREBASE_ADMIN_CLIENT_EMAIL,
    firebaseAdminPrivateKey: process.env.NUXT_FIREBASE_ADMIN_PRIVATE_KEY,

    // Public — exposed to client
    public: {
      firebaseApiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID,
    },
  },

  css: ['~/assets/css/main.css'],

  compatibilityDate: '2025-07-16',
})