import { defineEventHandler, readBody } from 'h3'
import { FieldValue } from 'firebase-admin/firestore'
import { verifyIdToken } from '../../utils/verifyToken'
import { useFirebaseAdmin } from '../../utils/firebaseAdmin'

export default defineEventHandler(async (event) => {
  const decoded = await verifyIdToken(event)

  const { db } = useFirebaseAdmin()

  // Only police officers can issue fines
  const callerSnap = await db.collection('users').doc(decoded.uid).get()
  if (callerSnap.data()?.role !== 'police') {
    throw createError({ statusCode: 403, statusMessage: 'Only police officers can issue fines' })
  }

  const { reportId, ownerId, plateNumber, amount, notes } = await readBody(event)

  if (!reportId || !ownerId || !plateNumber || !amount) {
    throw createError({ statusCode: 400, statusMessage: 'reportId, ownerId, plateNumber, and amount are required' })
  }

  const batch = db.batch()

  // 1. Update report status → investigated
  const reportRef = db.collection('reports').doc(reportId)
  batch.update(reportRef, { status: 'investigated' })

  // 2. Create fine document
  const fineRef = db.collection('fines').doc()
  batch.set(fineRef, {
    reportId,
    ownerId,
    plateNumber: String(plateNumber).toUpperCase(),
    amount: Number(amount),
    status: 'unpaid',
    notes: notes ?? '',
    issuedBy: decoded.uid,
    issuedAt: FieldValue.serverTimestamp(),
  })

  await batch.commit()

  return { ok: true, fineId: fineRef.id }
})
