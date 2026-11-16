import { MigrateOptions } from 'fireway';

export async function migrate({ firestore }: MigrateOptions) {
    // Write your Firestore migration logic here.
    // Example:
    // const snapshot = await firestore.collection('users').get();
    // const batch = firestore.batch();
    // snapshot.forEach(doc => {
    //     batch.update(doc.ref, { migratedAt: admin.firestore.FieldValue.serverTimestamp() });
    // });
    // await batch.commit();
}
