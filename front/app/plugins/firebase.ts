import type { Firestore } from 'firebase/firestore/lite'
import type { Functions } from 'firebase/functions'
import type { Messaging } from 'firebase/messaging'
import type { FirebaseStorage } from 'firebase/storage'
import {
    getAnalytics,
    type Analytics,
    setUserId,
    setUserProperties,
} from 'firebase/analytics'
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions'
import { useFirebaseApp, useFirestore, getCurrentUser, useFirebaseStorage } from 'vuefire'
import { getMessaging } from 'firebase/messaging'
import { initializeAppCheck, ReCaptchaV3Provider, CustomProvider } from 'firebase/app-check'
import { connectStorageEmulator } from 'firebase/storage'

type RemoteConfig = Record<string, any>

declare module '#app' {
    interface NuxtApp {
        $firestore: Firestore
        $functions: Functions
        $storage: FirebaseStorage
        $remoteConfig: RemoteConfig
        $analytics: Analytics
        $messaging: Messaging
    }
}

declare module 'vue' {
    interface ComponentCustomProperties {
        $firestore: Firestore
        $functions: Functions
        $storage: FirebaseStorage
        $remoteConfig: RemoteConfig
        $analytics: Analytics
    }
}

declare module '@vue/runtime-core' {
    interface ComponentCustomProperties {
        $firestore: Firestore
        $functions: Functions
        $storage: FirebaseStorage
        $remoteConfig: RemoteConfig
        $analytics: Analytics
    }
}

export default defineNuxtPlugin(async ({ provide, $config }) => {
    const {
        functions: functionsConfig,
        analytics: analyticsConfig,
    } = $config.public.firebase

    const firebaseApp = useFirebaseApp()

    if (import.meta.client) {
        const siteKey = import.meta.env.VITE_FIREBASE_APP_CHECK_SITE_KEY || 'dummy-key'
        const windowDebugToken = (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN
        const envDebugToken = import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN
        const isCypress = (window as any).Cypress

        if (windowDebugToken || envDebugToken || isCypress) {
            try {
                initializeAppCheck(firebaseApp, {
                    provider: new CustomProvider({
                        getToken: () => {
                            const debugToken = (window as any).FIREBASE_APPCHECK_DEBUG_TOKEN
                                || import.meta.env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN
                                || 'placeholder-token'
                            return Promise.resolve({
                                token: debugToken,
                                expireTimeMillis: Date.now() + 3600000
                            })
                        }
                    }),
                    isTokenAutoRefreshEnabled: true,
                })
            } catch (e) {
                console.debug('App Check already initialized or failed:', e)
            }
        } else {
            try {
                initializeAppCheck(firebaseApp, {
                    provider: new ReCaptchaV3Provider(siteKey),
                    isTokenAutoRefreshEnabled: true,
                })
            } catch (e) {
                console.debug('App Check already initialized or failed:', e)
            }
        }
    }

    const firestoreInstance = useFirestore()
    const storageInstance = useFirebaseStorage()

    provide('firestore', firestoreInstance)
    provide('storage', storageInstance)

    if (import.meta.dev && import.meta.client) {
        connectStorageEmulator(storageInstance, '127.0.0.1', 9199)
    }

    if (functionsConfig.enable) {
        const functionsInstance = getFunctions(firebaseApp, 'europe-west3')
        if (functionsConfig.enableEmulator) {
            connectFunctionsEmulator(functionsInstance, '127.0.0.1', 5001)
        }
        provide('functions', functionsInstance)
    }

    if (analyticsConfig?.enable) {
        const analyticsInstance = getAnalytics(firebaseApp)
        const user = useCurrentUser()
        if (user?.value?.uid) {
            setUserId(analyticsInstance, user.value?.uid)
            setUserProperties(analyticsInstance, {
                email: user.value?.email,
                displayName: user.value?.displayName,
            })
        }

        provide('analytics', analyticsInstance)
    }

    if (import.meta.client) {
        try {
            const messaging = getMessaging(firebaseApp)
            provide('messaging', messaging)
        } catch (e) {
            console.error('Messaging init failed:', e)
        }
    }
})