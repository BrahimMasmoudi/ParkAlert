import { doc } from 'firebase/firestore'
import { useDocument, useFirestore } from 'vuefire'

export const useUserStore = defineStore('user', () => {
  const authStore = useAuthStore()
  const toast = useToast()
  const router = useRouter()

  // Reactive Firestore document for the logged-in user
  const db = useFirestore()
  const userDocRef = computed(() =>
    authStore.currentUser?.uid
      ? doc(db, 'users', authStore.currentUser.uid)
      : null,
  )
  const { data: userProfile, pending: profileLoading } = useDocument(userDocRef)

  const role = computed(() => userProfile.value?.role as 'agent' | 'police' | 'owner' | undefined)

  /**
   * Called from the onboarding page.
   * POST /api/users/role — server route writes the role securely.
   */
  async function setRole(role: 'agent' | 'police' | 'owner') {
    const token = await authStore.getIdToken()
    const user = authStore.currentUser!

    try {
      await $fetch('/api/users/role', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: {
          role,
          name: user.displayName ?? user.email ?? 'Unknown',
          email: user.email,
          phone: user.phoneNumber ?? '',
        },
      })
      toast.add({ title: 'Role saved!', color: 'success' })
      await router.push(`/${role}`)
    }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to save role'
      toast.add({ title: 'Error saving role', description: msg, color: 'error' })
      throw e
    }
  }

  return {
    userProfile,
    profileLoading,
    role,
    setRole,
  }
})
