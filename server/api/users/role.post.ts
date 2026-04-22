import { defineEventHandler, readBody } from 'h3'
import { FieldValue } from 'firebase-admin/firestore'
import { verifyIdToken } from '../../utils/verifyToken'
import { useFirebaseAdmin } from '../../utils/firebaseAdmin'

export default defineEventHandler(async (event) => {
  const decoded = await verifyIdToken(event)
  const { role, name, email, phone } = await readBody(event)

  if (!['agent', 'police', 'owner'].includes(role)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid role' })
  }

  const { db } = useFirebaseAdmin()
  await db.collection('users').doc(decoded.uid).set(
    {
      uid: decoded.uid,
      email: email ?? decoded.email ?? '',
      name: name ?? decoded.name ?? '',
      phone: phone ?? '',
      role,
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  return { ok: true }
})
