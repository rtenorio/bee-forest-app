import { Router } from 'express';
import { generateSignedUrl } from '../lib/r2';

const router = Router();

// ── GET /api/media/signed-url?key={objectKey} ─────────────────────────────────
// Gera uma URL pré-assinada de leitura (GET) para um objeto privado no R2.
// Requer autenticação (qualquer perfil). A URL expira em 1 hora.

router.get('/signed-url', async (req, res, next) => {
  try {
    const key = req.query.key as string | undefined;

    if (!key || key.trim() === '') {
      res.status(400).json({ error: 'Parâmetro key é obrigatório' });
      return;
    }

    // Previne path traversal e chaves malformadas
    if (key.includes('..') || key.startsWith('/') || key.includes('\0')) {
      res.status(400).json({ error: 'key inválida' });
      return;
    }

    const url = await generateSignedUrl(key.trim(), 3600);
    res.json({ url });
  } catch (err) {
    next(err);
  }
});

export default router;
