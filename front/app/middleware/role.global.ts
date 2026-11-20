import { getCurrentUser, useFirestore } from 'vuefire'
import { doc, getDoc } from 'firebase/firestore'
import { resolveUserRoles, type UserRole } from '~/utils/roles'

const rolePaths: Record<UserRole, string> = {
  agent: '/agent',
  police: '/police',
  owner: '/owner',
}

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const user = await getCurrentUser()
  if (!user) return

  const db = useFirestore()
  const userDoc = await getDoc(doc(db, 'users', user.uid))
  const roles = userDoc.exists() ? resolveUserRoles(userDoc.data()) : []

  if (roles.length === 0) {
    if (to.path !== '/onboarding') {
      return navigateTo('/onboarding')
    }
    return
  }

  if (to.path === '/onboarding') {
    return navigateTo(roles.length > 1 ? '/select-role' : rolePaths[roles[0]!])
  }

  if (roles.length === 1) {
    const targetPath = rolePaths[roles[0]!]
    if (to.path !== targetPath && !to.path.startsWith(`${targetPath}/`)) {
      return navigateTo(targetPath)
    }
    return
  }

  if (to.path === '/' || to.path === '/login') {
    return navigateTo('/select-role')
  }
  if (to.path === '/select-role') {
    return
  }

  const matchedRole = (Object.keys(rolePaths) as UserRole[]).find(
    r => to.path === rolePaths[r] || to.path.startsWith(`${rolePaths[r]}/`),
  )
  if (matchedRole && roles.includes(matchedRole)) {
    return
  }

  return navigateTo('/select-role')
})
