export type UserRole = 'agent' | 'police' | 'owner'

const VALID_ROLES = new Set<UserRole>(['agent', 'police', 'owner'])

export function resolveUserRoles(
  data: { roles?: unknown } | null | undefined,
): UserRole[] {
  if (!data || !Array.isArray(data.roles)) return []

  const deduped: UserRole[] = []
  for (const r of data.roles) {
    if (typeof r === 'string' && VALID_ROLES.has(r as UserRole) && !deduped.includes(r as UserRole)) {
      deduped.push(r as UserRole)
    }
  }

  return deduped.sort((a, b) => {
    if (a === b) return 0
    if (a === 'owner') return 1
    if (b === 'owner') return -1
    return a.localeCompare(b)
  })
}
