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
          photoURL: request.auth!.token['picture'] ?? '',
          role,
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )

    return { ok: true }
  },
)

// ─────────────────────────────────────────────────────────────────
// updateUserProfile — any authenticated user
// ─────────────────────────────────────────────────────────────────
export const updateUserProfile = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    const uid = requireAuth(request.auth)

    const { fullName, identityNumber, birthDate, phone } = request.data as {
      fullName?: string
      identityNumber?: string
      birthDate?: string
      phone?: string
    }

    const updates: any = { updatedAt: FieldValue.serverTimestamp() }
    if (fullName !== undefined) updates.fullName = fullName
    if (identityNumber !== undefined) updates.identityNumber = identityNumber
    if (birthDate !== undefined) updates.birthDate = birthDate
    if (phone !== undefined) updates.phone = phone

    await db.collection('users').doc(uid).update(updates)

    return { ok: true }
  },
)

// ─────────────────────────────────────────────────────────────────
// addCar — owner only
// ─────────────────────────────────────────────────────────────────
export const addCar = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    const uid = requireAuth(request.auth)

    const callerSnap = await db.collection('users').doc(uid).get()
    if (callerSnap.data()?.role !== 'owner') {
      throw new HttpsError('permission-denied', 'Only owners can add cars')
    }

    const { plateNumber, brand, model, color, carteGriseUrl } = request.data as {
      plateNumber: string
      brand: string
      model: string
      color: string
      carteGriseUrl: string
    }

    if (!plateNumber || !brand || !model || !color || !carteGriseUrl) {
      throw new HttpsError(
        'invalid-argument',
        'plateNumber, brand, model, color, and carteGriseUrl are required',
      )
    }

    const carRef = db.collection('cars').doc()
    await carRef.set({
      id: carRef.id,
      ownerId: uid,
      plateNumber: String(plateNumber).toUpperCase(),
      brand,
      model,
      color,
      carteGriseUrl,
      status: 'activation_pending',
      createdAt: FieldValue.serverTimestamp(),
    })

    return { ok: true, carId: carRef.id }
  },
)

// ─────────────────────────────────────────────────────────────────
// retryCar — owner only (resubmit rejected car)
// ─────────────────────────────────────────────────────────────────
export const retryCar = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    const uid = requireAuth(request.auth)

    const callerSnap = await db.collection('users').doc(uid).get()
    if (callerSnap.data()?.role !== 'owner') {
      throw new HttpsError('permission-denied', 'Only owners can modify cars')
    }

    const { carId, plateNumber, brand, model, color, carteGriseUrl } = request.data as {
      carId: string
      plateNumber: string
      brand: string
      model: string
      color: string
      carteGriseUrl: string
    }

    if (!carId || !plateNumber || !brand || !model || !color || !carteGriseUrl) {
      throw new HttpsError(
        'invalid-argument',
        'carId, plateNumber, brand, model, color, and carteGriseUrl are required',
      )
    }

    const carRef = db.collection('cars').doc(carId)
    const carSnap = await carRef.get()

    if (!carSnap.exists) {
      throw new HttpsError('not-found', 'Car not found')
    }

    const car = carSnap.data()!

    if (car.ownerId !== uid) {
      throw new HttpsError('permission-denied', 'You can only modify your own cars')
    }

    if (car.status !== 'rejected') {
      throw new HttpsError('failed-precondition', 'You can only retry rejected cars')
    }

    await carRef.update({
      plateNumber: String(plateNumber).toUpperCase(),
      brand,
      model,
      color,
      carteGriseUrl,
      status: 'activation_pending',
      updatedAt: FieldValue.serverTimestamp(),
      rejectionReason: FieldValue.delete()
    })

    await db.collection('car_audit_logs').add({
      carId,
      actorId: uid,
      action: 'RETRY_ACTIVATION',
      timestamp: FieldValue.serverTimestamp(),
    })

    return { ok: true }
  },
)

// ─────────────────────────────────────────────────────────────────
// requestCarDeletion — owner only
// ─────────────────────────────────────────────────────────────────
export const requestCarDeletion = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    const uid = requireAuth(request.auth)

    const { carId } = request.data as { carId: string }
    if (!carId) throw new HttpsError('invalid-argument', 'carId is required')

    const carRef = db.collection('cars').doc(carId)
    const carSnap = await carRef.get()

    if (!carSnap.exists) throw new HttpsError('not-found', 'Car not found')

    const car = carSnap.data()!

    if (car.ownerId !== uid) {
      throw new HttpsError('permission-denied', 'You can only delete your own cars')
    }

    await carRef.update({
      status: 'deletion_requested',
      deletionRequestedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    await db.collection('car_audit_logs').add({
      carId,
      actorId: uid,
      action: 'DELETION_REQUESTED',
      timestamp: FieldValue.serverTimestamp(),
    })

    return { ok: true }
  },
)

export const cancelCarDeletion = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    const uid = requireAuth(request.auth)

    const { carId } = request.data as { carId: string }
    if (!carId) throw new HttpsError('invalid-argument', 'carId is required')

    const carRef = db.collection('cars').doc(carId)
    const carSnap = await carRef.get()

    if (!carSnap.exists) throw new HttpsError('not-found', 'Car not found')

    const car = carSnap.data()!

    if (car.ownerId !== uid) {
      throw new HttpsError('permission-denied', 'Not your car')
    }

    if (car.status !== 'deletion_requested') {
      throw new HttpsError('failed-precondition', 'Not pending deletion')
    }

    await carRef.update({
      status: 'activation_pending',
      deletionRequestedAt: null,
      updatedAt: FieldValue.serverTimestamp(),
    })

    await db.collection('car_audit_logs').add({
      carId,
      actorId: uid,
      action: 'DELETION_CANCELLED',
      timestamp: FieldValue.serverTimestamp(),
    })

    return { ok: true }
  },
)

// ─────────────────────────────────────────────────────────────────
// requestOwnershipTransfer — owner only
// ─────────────────────────────────────────────────────────────────
export const requestOwnershipTransfer = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    const uid = requireAuth(request.auth)

    const { carId, newOwnerId, carteGriseUrl } = request.data as {
      carId: string
      newOwnerId: string
      carteGriseUrl: string
    }

    if (!carId || !newOwnerId || !carteGriseUrl) {
      throw new HttpsError('invalid-argument', 'Missing required fields')
    }

    const carRef = db.collection('cars').doc(carId)
    const carSnap = await carRef.get()

    if (!carSnap.exists) {
      throw new HttpsError('not-found', 'Car not found')
    }

    const car = carSnap.data()!

    if (car.ownerId !== uid) {
      throw new HttpsError('permission-denied', 'Not your car')
    }

    const newOwnerSnap = await db.collection('users').doc(newOwnerId).get()
    if (!newOwnerSnap.exists || newOwnerSnap.data()?.role !== 'owner') {
      throw new HttpsError('not-found', 'New owner not found')
    }

    // Keep ownerId as is (old owner), set transferToOwnerId for the new one
    await carRef.update({
      status: 'transfer_requested',
      transferToOwnerId: newOwnerId,
      transferCarteGriseUrl: carteGriseUrl,
      updatedAt: FieldValue.serverTimestamp(),
      transferRequestedAt: FieldValue.serverTimestamp(),
      transferRejectionReason: FieldValue.delete(),
    })

    await db.collection('car_audit_logs').add({
      carId,
      actorId: uid,
      action: 'TRANSFER_REQUESTED',
      details: `Transfer requested to ${newOwnerId}`,
      timestamp: FieldValue.serverTimestamp(),
    })

    return { ok: true }
  }
)

// ─────────────────────────────────────────────────────────────────
// approveTransfer — police only
// ─────────────────────────────────────────────────────────────────
export const approveTransfer = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    requireAuth(request.auth)

    const { carId } = request.data as { carId: string }

    if (!carId) {
      throw new HttpsError('invalid-argument', 'carId is required')
    }

    const carRef = db.collection('cars').doc(carId)
    const carSnap = await carRef.get()

    if (!carSnap.exists) {
      throw new HttpsError('not-found', 'Car not found')
    }

    const car = carSnap.data()!

    if (car.status !== 'transfer_requested') {
      throw new HttpsError('failed-precondition', 'Car is not pending transfer')
    }

    // If this transfer targets a new owner, verify the previous owner (current ownerId) has no fines
    if (car.ownerId) {
      const finesSnap = await db.collection('fines')
        .where('ownerId', '==', car.ownerId)
        .where('plateNumber', '==', car.plateNumber)
        .where('status', '==', 'unpaid')
        .get()

      if (!finesSnap.empty) {
        throw new HttpsError('failed-precondition', 'Cannot approve transfer: unpaid fines exist for this vehicle.')
      }
    }

    const updates: any = {
      status: 'active',
      updatedAt: FieldValue.serverTimestamp(),
    }

    if (car.transferToOwnerId) {
      updates.ownerId = car.transferToOwnerId
      updates.ownershipHistory = FieldValue.arrayUnion(car.ownerId)
      updates.transferToOwnerId = FieldValue.delete()
      
      if (car.transferCarteGriseUrl) {
        updates.carteGriseUrl = car.transferCarteGriseUrl
        updates.transferCarteGriseUrl = FieldValue.delete()
      }
    }

    await carRef.update(updates)
    const uid = requireAuth(request.auth)

    await db.collection('car_audit_logs').add({
      carId,
      actorId: uid,
      action: 'TRANSFER_APPROVED',
      timestamp: FieldValue.serverTimestamp(),
    })

    return { ok: true }
  }
)

// ─────────────────────────────────────────────────────────────────
// rejectTransfer — police only
// ─────────────────────────────────────────────────────────────────
export const rejectTransfer = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    requireAuth(request.auth)

    const { carId, reason } = request.data as { carId: string; reason: string }

    if (!carId) {
      throw new HttpsError('invalid-argument', 'carId is required')
    }
    if (!reason || reason.trim() === '') {
      throw new HttpsError('invalid-argument', 'reason is required')
    }

    const carRef = db.collection('cars').doc(carId)
    const carSnap = await carRef.get()

    if (!carSnap.exists) {
      throw new HttpsError('not-found', 'Car not found')
    }

    const car = carSnap.data()!

    if (car.status !== 'transfer_requested') {
      throw new HttpsError('failed-precondition', 'Car is not pending transfer')
    }

    // Revert status to active so the old owner regains control
    await carRef.update({
      status: 'active',
      transferRejectionReason: reason,
      transferToOwnerId: FieldValue.delete(),
      transferCarteGriseUrl: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    const uid = requireAuth(request.auth)

    await db.collection('car_audit_logs').add({
      carId,
      actorId: uid,
      action: 'TRANSFER_REJECTED',
      details: reason,
      timestamp: FieldValue.serverTimestamp(),
    })

    return { ok: true }
  }
)

export const approveCar = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    requireAuth(request.auth)

    const { carId } = request.data as { carId: string }

    if (!carId) {
      throw new HttpsError('invalid-argument', 'carId is required')
    }

    const carRef = db.collection('cars').doc(carId)
    const carSnap = await carRef.get()

    if (!carSnap.exists) {
      throw new HttpsError('not-found', 'Car not found')
    }

    const car = carSnap.data()!

    if (car.status !== 'activation_pending') {
      throw new HttpsError(
        'failed-precondition',
        'Car is not pending approval',
      )
    }

    await carRef.update({
      status: 'active',
      updatedAt: FieldValue.serverTimestamp(),
    })
    const uid = requireAuth(request.auth)

    await db.collection('car_audit_logs').add({
      carId,
      actorId: uid,
      action: 'APPROVED',
      timestamp: FieldValue.serverTimestamp(),
    })

    return { ok: true }
  },
)

export const rejectCar = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    requireAuth(request.auth)

    const { carId, reason } = request.data as { carId: string; reason: string }

    if (!carId) {
      throw new HttpsError('invalid-argument', 'carId is required')
    }

    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
      throw new HttpsError('invalid-argument', 'reason is required and must not be empty')
    }

    const carRef = db.collection('cars').doc(carId)
    const carSnap = await carRef.get()

    if (!carSnap.exists) {
      throw new HttpsError('not-found', 'Car not found')
    }

    const car = carSnap.data()!

    if (car.status !== 'activation_pending') {
      throw new HttpsError(
        'failed-precondition',
        'Car is not pending approval',
      )
    }

    await carRef.update({
      status: 'rejected',
      rejectionReason: reason.trim(),
      updatedAt: FieldValue.serverTimestamp(),
    })

    const uid = requireAuth(request.auth)

    await db.collection('car_audit_logs').add({
      carId,
      actorId: uid,
      action: 'REJECTED',
      reason: reason.trim(),
      timestamp: FieldValue.serverTimestamp(),
    })

    return { ok: true }
  },
)

export const approveCarDeletion = onCall(
  { region: 'europe-west3', enforceAppCheck: true },
  async (request) => {
    const uid = requireAuth(request.auth)

    const callerSnap = await db.collection('users').doc(uid).get()
    if (callerSnap.data()?.role !== 'police') {
      throw new HttpsError('permission-denied', 'Only police can approve deletions')
    }

    const { carId } = request.data as { carId: string }
    if (!carId) throw new HttpsError('invalid-argument', 'carId is required')

    const carRef = db.collection('cars').doc(carId)
    const carSnap = await carRef.get()

    if (!carSnap.exists) throw new HttpsError('not-found', 'Car not found')

    const car = carSnap.data()!

    if (car.status !== 'deletion_requested') {
      throw new HttpsError('failed-precondition', 'Car not pending deletion')
    }

    await carRef.update({
      status: 'archived',
      archivedAt: FieldValue.serverTimestamp(),
      archivedBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
    })

    await db.collection('car_audit_logs').add({
      carId,
      actorId: uid,
      action: 'DELETION_APPROVED',
      timestamp: FieldValue.serverTimestamp(),
    })

    return { ok: true }
  },
)