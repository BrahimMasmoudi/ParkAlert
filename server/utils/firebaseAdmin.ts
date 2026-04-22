import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

let adminApp: App

export function useFirebaseAdmin() {
  if (!adminApp) {
    const config = useRuntimeConfig()

    const existingApps = getApps()
    if (existingApps.length > 0) {
      adminApp = existingApps[0]!
    }
    else {
      adminApp = initializeApp({
        credential: cert({
          projectId: config.firebaseAdminProjectId,
          clientEmail: config.firebaseAdminClientEmail,
          // Replace literal \n with actual newlines in the private key
          privateKey: config.firebaseAdminPrivateKey?.replace(/\\n/g, '\n'),
        }),
      })
    }
  }

  return {
    db: getFirestore(adminApp),
    auth: getAuth(adminApp),
  }
}
