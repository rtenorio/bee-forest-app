import { Request, Response, NextFunction } from 'express';

const ALLOWED_TYPES: Record<string, number> = {
  'audio/webm': 20 * 1024 * 1024,   // 20 MB
  'audio/mp4':  20 * 1024 * 1024,
  'audio/ogg':  20 * 1024 * 1024,
  'audio/wav':  20 * 1024 * 1024,
  'image/jpeg': 50 * 1024 * 1024,   // 50 MB
  'image/png':  50 * 1024 * 1024,
  'image/webp': 50 * 1024 * 1024,
};

/**
 * Validates upload requests before generating a pre-signed URL.
 * Expects `contentType` (required) and `fileSize` (optional, bytes) in the request body.
 *
 * Returns 400 if:
 *  - contentType is missing or not in the allowed list
 *  - fileSize exceeds the limit for the declared contentType
 */
export function validateUpload(req: Request, res: Response, next: NextFunction): void {
  const { contentType, fileSize } = req.body as { contentType?: string; fileSize?: number };

  if (!contentType) {
    res.status(400).json({ error: 'contentType é obrigatório' });
    return;
  }

  const maxBytes = ALLOWED_TYPES[contentType];
  if (maxBytes === undefined) {
    res.status(400).json({
      error: `Tipo de arquivo não permitido: ${contentType}`,
      allowed: Object.keys(ALLOWED_TYPES),
    });
    return;
  }

  if (fileSize !== undefined && fileSize !== null) {
    const fileSizeNum = Number(fileSize);
    if (Number.isNaN(fileSizeNum) || fileSizeNum <= 0) {
      res.status(400).json({ error: 'fileSize deve ser um número positivo em bytes' });
      return;
    }
    if (fileSizeNum > maxBytes) {
      const limitMB = maxBytes / (1024 * 1024);
      res.status(400).json({
        error: `Arquivo excede o tamanho máximo permitido de ${limitMB} MB para ${contentType}`,
        maxBytes,
        receivedBytes: fileSizeNum,
      });
      return;
    }
  }

  next();
}
