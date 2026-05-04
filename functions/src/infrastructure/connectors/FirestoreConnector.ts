import { Firestore, FieldValue } from 'firebase-admin/firestore';

export class FirestoreConnector {
  constructor(public readonly db: Firestore) {}

  getFieldValue() {
    return FieldValue;
  }

  getBatch() {
    return this.db.batch();
  }

  runTransaction<T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> {
    return this.db.runTransaction(updateFunction);
  }
}
