import { defineEventHandler, readBody } from 'h3'
import { FieldValue } from 'firebase-admin/firestore'
import { verifyIdToken } from '../../utils/verifyToken'
import { useFirebaseAdmin } from '../../utils/firebaseAdmin'

export default defineEventHandler(async (event) => {
  const decoded = await verifyIdToken(event)

  // Only agents can file reports
  const { db } = useFirebaseAdmin()
  const userSnap = await db.collection('users').doc(decoded.uid).get()
  if (userSnap.data()?.role !== 'agent') {
    throw createError({ statusCode: 403, statusMessage: 'Only agents can file reports' })
  }

  const { plateNumber, location, photoUrl, address } = await readBody(event)

  const hasLocation = location && typeof location.lat === 'number' && typeof location.lng === 'number'
  const hasAddress = address && address.trim().length > 0

  if (!plateNumber || (!hasLocation && !hasAddress)) {
    throw createError({ statusCode: 400, statusMessage: 'plateNumber and either location or address are required' })
  }

  const ref = await db.collection('reports').add({
    agentId: decoded.uid,
    plateNumber: String(plateNumber).toUpperCase(),
    location,
    photoUrl: photoUrl ?? '',
    address: address ?? '',
    status: 'pending',
    timestamp: FieldValue.serverTimestamp(),
  })

  return { ok: true, reportId: ref.id }
})
