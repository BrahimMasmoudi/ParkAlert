import { signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth'
import { useFirebaseAuth, useCurrentUser } from 'vuefire'

export const useAuthStore = defineStore('auth', () => {
  const router = useRouter()
  const toast = useToast()

  // Reactive current user from VueFire — undefined = loading, null = logged out
  const currentUser = useCurrentUser()
  const loading = ref(false)
  const auth = useFirebaseAuth()!

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider()
    provider.addScope('email')
    provider.addScope('profile')

    loading.value = true
    try {
      await signInWithPopup(toRaw(auth), provider)
      toast.add({ title: 'Signed in!', description: `Welcome, ${currentUser.value?.displayName ?? ''}`, color: 'success' })
      // Role middleware takes over from here
      await router.push('/')
    }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Sign-in failed'
      toast.add({ title: 'Sign-in error', description: msg, color: 'error' })
    }
    finally {
      loading.value = false
    }
  }

  async function logout() {
    await signOut(toRaw(auth))
    toast.add({ title: 'Signed out', color: 'neutral' })
    await router.push('/login')
  }

  /** Returns the current user's ID token for authenticated API calls. */
  async function getIdToken(): Promise<string> {
    const user = auth.currentUser
    if (!user) throw new Error('Not authenticated')
    return user.getIdToken()
  }

  return {
    currentUser,
    loading,
    loginWithGoogle,
    logout,
    getIdToken,
  }
})
