"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveCarDeletion = exports.rejectCar = exports.approveCar = exports.cancelCarDeletion = exports.requestCarDeletion = exports.addCar = exports.updateUserProfile = exports.setUserRole = exports.payFine = exports.issueFine = exports.createReport = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
// ─────────────────────────────────────────────────────────────────
// HELPER: assert authenticated, returns uid
// ─────────────────────────────────────────────────────────────────
function requireAuth(auth) {
    if (!auth?.uid)
        throw new https_1.HttpsError('unauthenticated', 'Must be signed in');
    return auth.uid;
}
// ─────────────────────────────────────────────────────────────────
// createReport — agents only
// Migrated from: POST /api/reports
// ─────────────────────────────────────────────────────────────────
exports.createReport = (0, https_1.onCall)({ region: 'europe-west3', enforceAppCheck: true }, async (request) => {
    const uid = requireAuth(request.auth);
    const userSnap = await db.collection('users').doc(uid).get();
    if (userSnap.data()?.role !== 'police') {
        throw new https_1.HttpsError('permission-denied', 'Only agents can file reports');
    }
    const { plateNumber, location, photoUrl, address } = request.data;
    const hasLocation = location != null &&
        typeof location.lat === 'number' &&
        typeof location.lng === 'number';
    const hasAddress = typeof address === 'string' && address.trim().length > 0;
    if (!plateNumber || (!hasLocation && !hasAddress)) {
        throw new https_1.HttpsError('invalid-argument', 'plateNumber and either location or address are required');
    }
    const ref = await db.collection('reports').add({
        agentId: uid,
        plateNumber: String(plateNumber).toUpperCase(),
        location: location ?? null,
        photoUrl: photoUrl ?? '',
        address: address ?? '',
        status: 'pending',
        timestamp: firestore_1.FieldValue.serverTimestamp(),
    });
    return { ok: true, reportId: ref.id };
});
// ─────────────────────────────────────────────────────────────────
// issueFine — police only
// Migrated from: POST /api/fines/issue
// ─────────────────────────────────────────────────────────────────
exports.issueFine = (0, https_1.onCall)({ region: 'europe-west3', enforceAppCheck: true }, async (request) => {
    const uid = requireAuth(request.auth);
    const callerSnap = await db.collection('users').doc(uid).get();
    if (callerSnap.data()?.role !== 'police') {
        throw new https_1.HttpsError('permission-denied', 'Only police officers can issue fines');
    }
    const { reportId, ownerId, plateNumber, amount, notes } = request.data;
    if (!reportId || !ownerId || !plateNumber || !amount) {
        throw new https_1.HttpsError('invalid-argument', 'reportId, ownerId, plateNumber, and amount are required');
    }
    const batch = db.batch();
    batch.update(db.collection('reports').doc(reportId), { status: 'investigated' });
    const fineRef = db.collection('fines').doc();
    batch.set(fineRef, {
        reportId,
        ownerId,
        plateNumber: String(plateNumber).toUpperCase(),
        amount: Number(amount),
        status: 'unpaid',
        notes: notes ?? '',
        issuedBy: uid,
        issuedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    await batch.commit();
    return { ok: true, fineId: fineRef.id };
});
// ─────────────────────────────────────────────────────────────────
// payFine — fine owner only
// Migrated from: POST /api/fines/pay
// ─────────────────────────────────────────────────────────────────
exports.payFine = (0, https_1.onCall)({ region: 'europe-west3', enforceAppCheck: true }, async (request) => {
    const uid = requireAuth(request.auth);
    const { fineId } = request.data;
    if (!fineId)
        throw new https_1.HttpsError('invalid-argument', 'fineId is required');
    const fineRef = db.collection('fines').doc(fineId);
    const fineSnap = await fineRef.get();
    if (!fineSnap.exists)
        throw new https_1.HttpsError('not-found', 'Fine not found');
    const fine = fineSnap.data();
    if (fine.ownerId !== uid) {
        throw new https_1.HttpsError('permission-denied', 'You can only pay your own fines');
    }
    if (fine.status === 'paid') {
        throw new https_1.HttpsError('already-exists', 'This fine is already paid');
    }
    const batch = db.batch();
    batch.update(fineRef, {
        status: 'paid',
        paidAt: firestore_1.FieldValue.serverTimestamp(),
    });
    if (fine.reportId) {
        batch.update(db.collection('reports').doc(fine.reportId), { status: 'resolved' });
    }
    await batch.commit();
    return { ok: true };
});
// ─────────────────────────────────────────────────────────────────
// setUserRole — any authenticated user (onboarding)
// Migrated from: POST /api/users/role
// ─────────────────────────────────────────────────────────────────
exports.setUserRole = (0, https_1.onCall)({ region: 'europe-west3', enforceAppCheck: true }, async (request) => {
    const uid = requireAuth(request.auth);
    const { role, name, email, phone } = request.data;
    if (!['agent', 'police', 'owner'].includes(role)) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid role');
    }
    await db
        .collection('users')
        .doc(uid)
        .set({
        uid,
        email: email ?? request.auth.token['email'] ?? '',
        name: name ?? request.auth.token['name'] ?? '',
        phone: phone ?? '',
        photoURL: request.auth.token['picture'] ?? '',
        role,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { ok: true };
});
// ─────────────────────────────────────────────────────────────────
// updateUserProfile — any authenticated user
// ─────────────────────────────────────────────────────────────────
exports.updateUserProfile = (0, https_1.onCall)({ region: 'europe-west3', enforceAppCheck: true }, async (request) => {
    const uid = requireAuth(request.auth);
    const { fullName, identityNumber, birthDate, phone } = request.data;
    const updates = { updatedAt: firestore_1.FieldValue.serverTimestamp() };
    if (fullName !== undefined)
        updates.fullName = fullName;
    if (identityNumber !== undefined)
        updates.identityNumber = identityNumber;
    if (birthDate !== undefined)
        updates.birthDate = birthDate;
    if (phone !== undefined)
        updates.phone = phone;
    await db.collection('users').doc(uid).update(updates);
    return { ok: true };
});
// ─────────────────────────────────────────────────────────────────
// addCar — owner only
// ─────────────────────────────────────────────────────────────────
exports.addCar = (0, https_1.onCall)({ region: 'europe-west3', enforceAppCheck: true }, async (request) => {
    const uid = requireAuth(request.auth);
    const callerSnap = await db.collection('users').doc(uid).get();
    if (callerSnap.data()?.role !== 'owner') {
        throw new https_1.HttpsError('permission-denied', 'Only owners can add cars');
    }
    const { plateNumber, brand, model, color, carteGriseUrl } = request.data;
    if (!plateNumber || !brand || !model || !color || !carteGriseUrl) {
        throw new https_1.HttpsError('invalid-argument', 'plateNumber, brand, model, color, and carteGriseUrl are required');
    }
    const carRef = db.collection('cars').doc();
    await carRef.set({
        id: carRef.id,
        ownerId: uid,
        plateNumber: String(plateNumber).toUpperCase(),
        brand,
        model,
        color,
        carteGriseUrl,
        status: 'activation_pending',
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    });
    return { ok: true, carId: carRef.id };
});
// ─────────────────────────────────────────────────────────────────
// requestCarDeletion — owner only
// ─────────────────────────────────────────────────────────────────
exports.requestCarDeletion = (0, https_1.onCall)({ region: 'europe-west3', enforceAppCheck: true }, async (request) => {
    const uid = requireAuth(request.auth);
    const { carId } = request.data;
    if (!carId)
        throw new https_1.HttpsError('invalid-argument', 'carId is required');
    const carRef = db.collection('cars').doc(carId);
    const carSnap = await carRef.get();
    if (!carSnap.exists)
        throw new https_1.HttpsError('not-found', 'Car not found');
    const car = carSnap.data();
    if (car.ownerId !== uid) {
        throw new https_1.HttpsError('permission-denied', 'You can only delete your own cars');
    }
    await carRef.update({
        status: 'deletion_requested',
        deletionRequestedAt: firestore_1.FieldValue.serverTimestamp(),
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    await db.collection('car_audit_logs').add({
        carId,
        actorId: uid,
        action: 'DELETION_REQUESTED',
        timestamp: firestore_1.FieldValue.serverTimestamp(),
    });
    return { ok: true };
});
exports.cancelCarDeletion = (0, https_1.onCall)({ region: 'europe-west3', enforceAppCheck: true }, async (request) => {
    const uid = requireAuth(request.auth);
    const { carId } = request.data;
    if (!carId)
        throw new https_1.HttpsError('invalid-argument', 'carId is required');
    const carRef = db.collection('cars').doc(carId);
    const carSnap = await carRef.get();
    if (!carSnap.exists)
        throw new https_1.HttpsError('not-found', 'Car not found');
    const car = carSnap.data();
    if (car.ownerId !== uid) {
        throw new https_1.HttpsError('permission-denied', 'Not your car');
    }
    if (car.status !== 'deletion_requested') {
        throw new https_1.HttpsError('failed-precondition', 'Not pending deletion');
    }
    await carRef.update({
        status: 'active',
        deletionRequestedAt: null,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    await db.collection('car_audit_logs').add({
        carId,
        actorId: uid,
        action: 'DELETION_CANCELLED',
        timestamp: firestore_1.FieldValue.serverTimestamp(),
    });
    return { ok: true };
});
exports.approveCar = (0, https_1.onCall)({ region: 'europe-west3', enforceAppCheck: true }, async (request) => {
    requireAuth(request.auth);
    const { carId } = request.data;
    if (!carId) {
        throw new https_1.HttpsError('invalid-argument', 'carId is required');
    }
    const carRef = db.collection('cars').doc(carId);
    const carSnap = await carRef.get();
    if (!carSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Car not found');
    }
    const car = carSnap.data();
    if (car.status !== 'activation_pending') {
        throw new https_1.HttpsError('failed-precondition', 'Car is not pending approval');
    }
    await carRef.update({
        status: 'active',
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    const uid = requireAuth(request.auth);
    await db.collection('car_audit_logs').add({
        carId,
        actorId: uid,
        action: 'APPROVED',
        timestamp: firestore_1.FieldValue.serverTimestamp(),
    });
    return { ok: true };
});
exports.rejectCar = (0, https_1.onCall)({ region: 'europe-west3', enforceAppCheck: true }, async (request) => {
    requireAuth(request.auth);
    const { carId } = request.data;
    if (!carId) {
        throw new https_1.HttpsError('invalid-argument', 'carId is required');
    }
    const carRef = db.collection('cars').doc(carId);
    const carSnap = await carRef.get();
    if (!carSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Car not found');
    }
    const car = carSnap.data();
    if (car.status !== 'activation_pending') {
        throw new https_1.HttpsError('failed-precondition', 'Car is not pending approval');
    }
    await carRef.update({
        status: 'rejected',
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    const uid = requireAuth(request.auth);
    await db.collection('car_audit_logs').add({
        carId,
        actorId: uid,
        action: 'REJECTED',
        timestamp: firestore_1.FieldValue.serverTimestamp(),
    });
    return { ok: true };
});
exports.approveCarDeletion = (0, https_1.onCall)({ region: 'europe-west3', enforceAppCheck: true }, async (request) => {
    const uid = requireAuth(request.auth);
    const callerSnap = await db.collection('users').doc(uid).get();
    if (callerSnap.data()?.role !== 'police') {
        throw new https_1.HttpsError('permission-denied', 'Only police can approve deletions');
    }
    const { carId } = request.data;
    if (!carId)
        throw new https_1.HttpsError('invalid-argument', 'carId is required');
    const carRef = db.collection('cars').doc(carId);
    const carSnap = await carRef.get();
    if (!carSnap.exists)
        throw new https_1.HttpsError('not-found', 'Car not found');
    const car = carSnap.data();
    if (car.status !== 'deletion_requested') {
        throw new https_1.HttpsError('failed-precondition', 'Car not pending deletion');
    }
    await carRef.update({
        status: 'archived',
        archivedAt: firestore_1.FieldValue.serverTimestamp(),
        archivedBy: uid,
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    });
    await db.collection('car_audit_logs').add({
        carId,
        actorId: uid,
        action: 'DELETION_APPROVED',
        timestamp: firestore_1.FieldValue.serverTimestamp(),
    });
    return { ok: true };
});
//# sourceMappingURL=index.js.map