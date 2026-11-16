import { getStorage } from 'firebase-admin/storage';
import { DocumentStoragePort } from '../../../domain/repositories/storage.port';
import { DomainError } from '../../../domain/errors/domain.error';

/**
 * Generates short-lived read-only V4 signed URLs via Firebase Admin Storage,
 * with a Storage Emulator fallback when running locally without a service-account key.
 */
export class StorageSignedUrlAdapter implements DocumentStoragePort {
  async getSignedReadUrl(
    objectPath: string,
    ttlSeconds = 300
  ): Promise<{ url: string; expiresAt: number }> {
    const bucket = getStorage().bucket();
    const file = bucket.file(objectPath);
    const expiresAt = Date.now() + ttlSeconds * 1000;

    const emulatorHost =
      process.env.FIREBASE_STORAGE_EMULATOR_HOST || process.env.STORAGE_EMULATOR_HOST;

    if (emulatorHost) {
      const [exists] = await file.exists();
      if (!exists) {
        throw new DomainError('NOT_FOUND', 'Document not found in storage');
      }
      const [metadata] = await file.getMetadata();
      const [contents] = await file.download();
      const contentType = metadata.contentType || 'application/octet-stream';
      return {
        url: `data:${contentType};base64,${contents.toString('base64')}`,
        expiresAt,
      };
    }

    const [exists] = await file.exists();
    if (!exists) {
      throw new DomainError('NOT_FOUND', 'Document not found in storage');
    }

    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: expiresAt,
    });

    return { url, expiresAt };
  }
}
