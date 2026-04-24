import { getCurrentUser } from 'vuefire'

export default defineNuxtRouteMiddleware(async (to) => {
  // Public routes that don't require authentication
  const publicRoutes = ['/login']
  if (publicRoutes.includes(to.path)) return

  // Skip auth guard on server side since sessionCookie is false
  if (import.meta.server) return

  const user = await getCurrentUser()

  // Not logged in → go to login
  if (!user) {
    return navigateTo('/login')
  }
})
