import { collection, doc, documentId, getDocs, query, where } from 'firebase/firestore'
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
  const inFlightUsers = new Map<string, Promise<void>>()

  /** Fetches user profiles in batches of 30 via documentId IN queries and deduplicates concurrent requests. */
  async function fetchUsers(uids: string[]): Promise<void> {
    const uniqueUids = [...new Set(uids.filter(Boolean))]
    if (uniqueUids.length === 0) return

    const activePromises = new Set<Promise<void>>()
    const toFetch: string[] = []

    for (const uid of uniqueUids) {
      const existingPromise = inFlightUsers.get(uid)
      if (existingPromise) {
        activePromises.add(existingPromise)
        continue
      }
      if (!usersCache.value[uid] || usersCache.value[uid]._loading) {
        toFetch.push(uid)
      }
    }

    const batchSize = 30
    for (let i = 0; i < toFetch.length; i += batchSize) {
      const chunk = toFetch.slice(i, i + batchSize)
      for (const uid of chunk) {
        usersCache.value[uid] = { _loading: true }
      }

      const chunkPromise = (async () => {
        try {
          const q = query(collection(db, 'users'), where(documentId(), 'in', chunk))
          const snap = await getDocs(q)
          const foundIds = new Set<string>()

          snap.docs.forEach((docSnap) => {
            foundIds.add(docSnap.id)
            usersCache.value[docSnap.id] = { id: docSnap.id, ...docSnap.data() }
          })

          for (const uid of chunk) {
            if (!foundIds.has(uid)) {
              usersCache.value[uid] = { name: 'Unknown User' }
            }
          }
        }
        catch (e) {
          console.error('Failed to fetch users:', e)
          for (const uid of chunk) {
            if (usersCache.value[uid]?._loading) {
              usersCache.value[uid] = undefined
            }
          }
        }
        finally {
          for (const uid of chunk) {
            inFlightUsers.delete(uid)
          }
        }
      })()

      for (const uid of chunk) {
        inFlightUsers.set(uid, chunkPromise)
      }
      activePromises.add(chunkPromise)
    }

    if (activePromises.size > 0) {
      await Promise.all(activePromises)
    }
  }

  async function fetchUser(uid: string) {
    if (!uid) return undefined
    if (!usersCache.value[uid] || usersCache.value[uid]._loading || inFlightUsers.has(uid)) {
      await fetchUsers([uid])
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
    fetchUsers,
  }
})
