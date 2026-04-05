import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const R2_ACCOUNT_ID  = process.env.R2_ACCOUNT_ID       ?? '';
const R2_ACCESS_KEY  = process.env.R2_ACCESS_KEY_ID    ?? '';
const R2_SECRET_KEY  = process.env.R2_SECRET_ACCESS_KEY ?? '';
const R2_BUCKET      = process.env.R2_BUCKET_NAME      ?? 'bee-forest-audio';
const R2_ENDPOINT    = process.env.R2_ENDPOINT         ?? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const R2_PUBLIC_URL  = process.env.R2_PUBLIC_URL       ?? ''; // ex: https://pub-xxx.r2.dev

export const r2 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
});

/**
 * Gera uma URL pré-assinada para upload direto do cliente para o R2.
 * O frontend faz PUT direto na URL gerada — o backend nunca recebe o binário.
 */
export async function getUploadUrl(key: string, contentType: string): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2, cmd, { expiresIn: 300 }); // 5 minutos
}

export function getPublicUrl(key: string): string {
  return `${R2_PUBLIC_URL}/${key}`;
}

export async function deleteObject(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}
