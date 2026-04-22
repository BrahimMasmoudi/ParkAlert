import { useCurrentUser } from 'vuefire'
import { doc, getDoc } from 'firebase/firestore'
import { useFirestore } from 'vuefire'

export default defineNuxtRouteMiddleware(async (to) => {
  const user = useCurrentUser()

  // Only run for authenticated users on non-onboarding routes
  if (!user.value || to.path === '/onboarding' || to.path === '/login') return

  const db = useFirestore()
  const userDoc = await getDoc(doc(db, 'users', user.value.uid))

  if (!userDoc.exists() || !userDoc.data()?.role) {
    // First login — no role yet
    return navigateTo('/onboarding')
  }

  const role = userDoc.data()?.role as string

  // Prevent users from accessing a dashboard that doesn't match their role
  const rolePaths: Record<string, string> = {
    agent: '/agent',
    police: '/police',
    owner: '/owner',
  }

  const correctPath = rolePaths[role]
  if (correctPath && !to.path.startsWith(correctPath)) {
    // Only redirect if they're at the root or a wrong dashboard
    if (to.path === '/' || Object.values(rolePaths).some(p => to.path.startsWith(p))) {
      return navigateTo(correctPath)
    }
  }
})
