import { UserRepository } from '../../../domain/repositories/user.repository';
import { User, UserRole } from '../../../domain/entities/user.entity';
import { TransactionContext } from '../../../domain/repositories/transaction.port';
import { FirestoreConnector } from '../../connectors/FirestoreConnector';
import { asFirestoreTransaction } from './FirestoreTransactionRunner';

const VALID_ROLES = new Set<UserRole>(['agent', 'police', 'owner']);

function extractUserRoles(data: Record<string, any>): UserRole[] {
  if (!Array.isArray(data.roles)) {
    return [];
  }
  return data.roles.filter((r): r is UserRole => VALID_ROLES.has(r));
}

export class FirestoreUserRepository implements UserRepository {
  constructor(private readonly connector: FirestoreConnector) {}

  async getById(uid: string, tx?: TransactionContext): Promise<User | null> {
    const ref = this.connector.db.collection('users').doc(uid);
    const firestoreTx = asFirestoreTransaction(tx);
    const doc = firestoreTx ? await firestoreTx.get(ref) : await ref.get();
    if (!doc.exists) return null;

    const raw = doc.data() as Record<string, any>;
    return {
      ...raw,
      uid: raw.uid ?? doc.id,
      roles: extractUserRoles(raw),
    } as User;
  }

  async save(user: Partial<User>, tx?: TransactionContext): Promise<void> {
    if (!user.uid) throw new Error('User UID is required for saving');
    const ref = this.connector.db.collection('users').doc(user.uid);
    const firestoreTx = asFirestoreTransaction(tx);
    const snap = firestoreTx ? await firestoreTx.get(ref) : await ref.get();

    const payload: Record<string, any> = { ...user };
    if (!snap.exists || !snap.data()?.createdAt) {
      payload.createdAt = this.connector.getFieldValue().serverTimestamp();
    }

    if (firestoreTx) {
      firestoreTx.set(ref, payload, { merge: true });
    } else {
      await ref.set(payload, { merge: true });
    }
  }

  async update(uid: string, updates: Partial<User>): Promise<void> {
    await this.connector.db.collection('users').doc(uid).update({
      ...updates,
      updatedAt: this.connector.getFieldValue().serverTimestamp(),
    });
  }
}
