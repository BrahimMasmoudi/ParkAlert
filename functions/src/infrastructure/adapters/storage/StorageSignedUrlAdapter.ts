import { getStorage } from 'firebase-admin/storage';
import { DocumentStoragePort } from '../../../domain/repositories/storage.port';
import { DomainError } from '../../../domain/errors/domain.error';

const ALLOWED_RASTER_CONTENT_TYPES = /^image\/(jpeg|png|webp)$/;
const MAX_REPORT_PHOTO_BYTES = 1572864; // 1.5 MB

/**
 * Generates short-lived read-only V4 signed URLs via Firebase Admin Storage,
 * with a Storage Emulator fallback when running locally without a service-account key.
 */
export class StorageSignedUrlAdapter implements DocumentStoragePort {
  async verifyRasterImage(objectPath: string): Promise<boolean> {
    const file = getStorage().bucket().file(objectPath);
    const [exists] = await file.exists();
    if (!exists) return false;

    const [metadata] = await file.getMetadata();
    const contentType = String(metadata.contentType ?? '');
    const size = Number(metadata.size ?? 0);
    return ALLOWED_RASTER_CONTENT_TYPES.test(contentType) && size > 0 && size < MAX_REPORT_PHOTO_BYTES;
  }

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
