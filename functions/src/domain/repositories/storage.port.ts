/**
 * Port for generating short-lived read URLs for private document storage objects.
 */
export interface DocumentStoragePort {
  getSignedReadUrl(objectPath: string, ttlSeconds: number): Promise<{ url: string; expiresAt: number }>;
}
