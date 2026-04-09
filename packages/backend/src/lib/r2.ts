import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { r2, R2_BUCKET } from '../services/r2';

/**
 * Generates a pre-signed GET URL for a private R2 object.
 * The URL expires after `expiresInSeconds` (default: 3600 = 1 hour).
 *
 * Use this whenever the backend needs to expose a media file to a client
 * instead of returning the permanent public URL.
 */
export async function generateSignedUrl(
  objectKey: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: objectKey,
  });
  return getSignedUrl(r2, cmd, { expiresIn: expiresInSeconds });
}
