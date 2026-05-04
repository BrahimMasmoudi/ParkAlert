import { UserRepository } from '../../../domain/repositories/user.repository';
import { User } from '../../../domain/entities/user.entity';
import { FirestoreConnector } from '../../connectors/FirestoreConnector';

export class FirestoreUserRepository implements UserRepository {
  constructor(private readonly connector: FirestoreConnector) { }

  async getById(uid: string): Promise<User | null> {
    const doc = await this.connector.db.collection('users').doc(uid).get();
    if (!doc.exists) return null;
    return doc.data() as User;
  }

  async save(user: Partial<User>): Promise<void> {
    if (!user.uid) throw new Error('User UID is required for saving');
    await this.connector.db.collection('users').doc(user.uid).set(
      {
        ...user,
        createdAt: this.connector.getFieldValue().serverTimestamp(),
      },
      { merge: true }
    );
  }

  async update(uid: string, updates: Partial<User>): Promise<void> {
    await this.connector.db.collection('users').doc(uid).update({
      ...updates,
      updatedAt: this.connector.getFieldValue().serverTimestamp(),
    });
  }
}
