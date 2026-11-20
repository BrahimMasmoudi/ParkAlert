import { doc, getDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { useDocument, useFirestore } from 'vuefire'
import { resolveUserRoles, type UserRole } from '~/utils/roles'

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

  const roles = computed<UserRole[]>(() => resolveUserRoles(userProfile.value))
  const isMultiRole = computed(() => roles.value.length > 1)

  function hasRole(role: UserRole) {
    return roles.value.includes(role)
  }

  /**
   * Called from the onboarding page.
   * Calls the setUserRole Cloud Function — writes the roles array securely via Firebase Auth context.
   */
  async function setRole(role: UserRole) {
    const user = authStore.currentUser!

    try {
      const { $functions } = useNuxtApp()
      await httpsCallable($functions, 'setUserRole')({
        role,
        name: user.displayName ?? user.email ?? 'Unknown',
        email: user.email,
        phone: user.phoneNumber ?? '',
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

  async function updateProfile(payload: { fullName: string, identityNumber: string, birthDate: string, phone: string }) {
    try {
      const { $functions } = useNuxtApp()
      await httpsCallable($functions, 'updateUserProfile')(payload)
      toast.add({ title: 'Profile updated successfully', color: 'success' })
    }
    catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update profile'
      toast.add({ title: 'Error updating profile', description: msg, color: 'error' })
      throw e
    }
  }

  const usersCache = ref<Record<string, any>>({})

  async function fetchUser(uid: string) {
    if (usersCache.value[uid] || !uid) return usersCache.value[uid]

    // Mark as fetching to prevent duplicate calls
    usersCache.value[uid] = { _loading: true }

    try {
      const snap = await getDoc(doc(db, 'users', uid))
      if (snap.exists()) {
        usersCache.value[uid] = { id: snap.id, ...snap.data() }
      }
      else {
        usersCache.value[uid] = { name: 'Unknown User' }
      }
    }
    catch (e) {
      console.error('Failed to fetch user:', e)
      usersCache.value[uid] = { name: 'Unknown User' }
    }

    return usersCache.value[uid]
  }

  return {
    userProfile,
    profileLoading,
    roles,
    hasRole,
    isMultiRole,
    setRole,
    updateProfile,
    usersCache,
    fetchUser,
  }
})
