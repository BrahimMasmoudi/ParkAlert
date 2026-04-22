import type { H3Event } from 'h3'
import { getHeader, createError } from 'h3'
import { useFirebaseAdmin } from './firebaseAdmin'

/**
 * Extracts and verifies the Firebase ID token from the Authorization header.
 * Throws a 401 if missing or invalid.
 */
export async function verifyIdToken(event: H3Event) {
  const authHeader = getHeader(event, 'authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Missing auth token' })
  }

  const { auth } = useFirebaseAdmin()

  try {
    const decoded = await auth.verifyIdToken(token)
    return decoded
  }
  catch {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired token' })
  }
}
