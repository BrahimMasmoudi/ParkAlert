import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { onCall, HttpsError } from 'firebase-functions/v2/https'

initializeApp()
const db = getFirestore()

// ─────────────────────────────────────────────────────────────────
// HELPER: assert authenticated, returns uid
// ─────────────────────────────────────────────────────────────────
function requireAuth(auth: { uid: string } | undefined): string {
  if (!auth?.uid) throw new HttpsError('unauthenticated', 'Must be signed in')
  return auth.uid
}

// ─────────────────────────────────────────────────────────────────
// createReport — agents only
// Migrated from: POST /api/reports
// ─────────────────────────────────────────────────────────────────
export const createReport = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    const uid = requireAuth(request.auth)

    const userSnap = await db.collection('users').doc(uid).get()
    if (userSnap.data()?.role !== 'agent') {
      throw new HttpsError('permission-denied', 'Only agents can file reports')
    }

    const { plateNumber, location, photoUrl, address } = request.data as {
      plateNumber: string
      location?: { lat: number; lng: number } | null
      photoUrl?: string
      address?: string
    }

    const hasLocation =
      location != null &&
      typeof location.lat === 'number' &&
      typeof location.lng === 'number'
    const hasAddress = typeof address === 'string' && address.trim().length > 0

    if (!plateNumber || (!hasLocation && !hasAddress)) {
      throw new HttpsError(
        'invalid-argument',
        'plateNumber and either location or address are required',
      )
    }

    const ref = await db.collection('reports').add({
      agentId: uid,
      plateNumber: String(plateNumber).toUpperCase(),
      location: location ?? null,
      photoUrl: photoUrl ?? '',
      address: address ?? '',
      status: 'pending',
      timestamp: FieldValue.serverTimestamp(),
    })

    return { ok: true, reportId: ref.id }
  },
)

// ─────────────────────────────────────────────────────────────────
// issueFine — police only
// Migrated from: POST /api/fines/issue
// ─────────────────────────────────────────────────────────────────
export const issueFine = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    const uid = requireAuth(request.auth)

    const callerSnap = await db.collection('users').doc(uid).get()
    if (callerSnap.data()?.role !== 'police') {
      throw new HttpsError('permission-denied', 'Only police officers can issue fines')
    }

    const { reportId, ownerId, plateNumber, amount, notes } = request.data as {
      reportId: string
      ownerId: string
      plateNumber: string
      amount: number
      notes?: string
    }

    if (!reportId || !ownerId || !plateNumber || !amount) {
      throw new HttpsError(
        'invalid-argument',
        'reportId, ownerId, plateNumber, and amount are required',
      )
    }

    const batch = db.batch()
    batch.update(db.collection('reports').doc(reportId), { status: 'investigated' })

    const fineRef = db.collection('fines').doc()
    batch.set(fineRef, {
      reportId,
      ownerId,
      plateNumber: String(plateNumber).toUpperCase(),
      amount: Number(amount),
      status: 'unpaid',
      notes: notes ?? '',
      issuedBy: uid,
      issuedAt: FieldValue.serverTimestamp(),
    })

    await batch.commit()
    return { ok: true, fineId: fineRef.id }
  },
)

// ─────────────────────────────────────────────────────────────────
// payFine — fine owner only
// Migrated from: POST /api/fines/pay
// ─────────────────────────────────────────────────────────────────
export const payFine = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    const uid = requireAuth(request.auth)

    const { fineId } = request.data as { fineId: string }
    if (!fineId) throw new HttpsError('invalid-argument', 'fineId is required')

    const fineRef = db.collection('fines').doc(fineId)
    const fineSnap = await fineRef.get()

    if (!fineSnap.exists) throw new HttpsError('not-found', 'Fine not found')

    const fine = fineSnap.data()!
    if (fine.ownerId !== uid) {
      throw new HttpsError('permission-denied', 'You can only pay your own fines')
    }
    if (fine.status === 'paid') {
      throw new HttpsError('already-exists', 'This fine is already paid')
    }

    const batch = db.batch()
    batch.update(fineRef, {
      status: 'paid',
      paidAt: FieldValue.serverTimestamp(),
    })
    if (fine.reportId) {
      batch.update(db.collection('reports').doc(fine.reportId), { status: 'resolved' })
    }

    await batch.commit()
    return { ok: true }
  },
)

// ─────────────────────────────────────────────────────────────────
// setUserRole — any authenticated user (onboarding)
// Migrated from: POST /api/users/role
// ─────────────────────────────────────────────────────────────────
export const setUserRole = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    const uid = requireAuth(request.auth)

    const { role, name, email, phone } = request.data as {
      role: string
      name?: string
      email?: string
      phone?: string
    }

    if (!['agent', 'police', 'owner'].includes(role)) {
      throw new HttpsError('invalid-argument', 'Invalid role')
    }

    await db
      .collection('users')
      .doc(uid)
      .set(
        {
          uid,
          email: email ?? request.auth!.token['email'] ?? '',
          name: name ?? request.auth!.token['name'] ?? '',
          phone: phone ?? '',
          role,
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )

    return { ok: true }
  },
)
