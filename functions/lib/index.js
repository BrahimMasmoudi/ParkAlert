"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setUserRole = exports.payFine = exports.issueFine = exports.createReport = void 0;
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
    if (userSnap.data()?.role !== 'agent') {
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
        role,
        createdAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { ok: true };
});
//# sourceMappingURL=index.js.map