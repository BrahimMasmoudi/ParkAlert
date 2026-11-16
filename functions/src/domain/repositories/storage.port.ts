/**
 * Port for generating short-lived read URLs and verifying stored evidence objects.
 */
export interface DocumentStoragePort {
  getSignedReadUrl(objectPath: string, ttlSeconds: number): Promise<{ url: string; expiresAt: number }>;
  verifyRasterImage(objectPath: string): Promise<boolean>;
}
