import { defineEventHandler, readBody } from 'h3'
import { FieldValue } from 'firebase-admin/firestore'
import { verifyIdToken } from '../../utils/verifyToken'
import { useFirebaseAdmin } from '../../utils/firebaseAdmin'

export default defineEventHandler(async (event) => {
  const decoded = await verifyIdToken(event)

  const { db } = useFirebaseAdmin()

  // Only the owner who owns the fine can pay it
  const { fineId } = await readBody(event)
  if (!fineId) {
    throw createError({ statusCode: 400, statusMessage: 'fineId is required' })
  }

  const fineRef = db.collection('fines').doc(fineId)
  const fineSnap = await fineRef.get()

  if (!fineSnap.exists) {
    throw createError({ statusCode: 404, statusMessage: 'Fine not found' })
  }

  const fine = fineSnap.data()!
  if (fine.ownerId !== decoded.uid) {
    throw createError({ statusCode: 403, statusMessage: 'You can only pay your own fines' })
  }

  if (fine.status === 'paid') {
    throw createError({ statusCode: 409, statusMessage: 'This fine is already paid' })
  }

  const batch = db.batch()

  // 1. Mark the fine as paid
  batch.update(fineRef, {
    status: 'paid',
    paidAt: FieldValue.serverTimestamp(),
  })

  // 2. Update the associated report to resolved
  if (fine.reportId) {
    const reportRef = db.collection('reports').doc(fine.reportId)
    batch.update(reportRef, { status: 'resolved' })
  }

  await batch.commit()

  return { ok: true }
})
