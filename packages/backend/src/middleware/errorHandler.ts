import { Request, Response, NextFunction } from 'express';

interface ErroComStatus extends Error {
  status?: number;
  statusCode?: number;
}

export function errorHandler(
  err: ErroComStatus,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error(err);

  // body-parser e afins marcam o próprio status (ex.: 413 entity.too.large).
  // Sem respeitar isso, erro de cliente chegava ao app como 500 genérico e a
  // causa real ficava invisível — foi o que escondeu o bug da análise de fotos.
  const status = err.status ?? err.statusCode ?? 500;
  const ehErroDoCliente = status >= 400 && status < 500;

  res.status(ehErroDoCliente ? status : 500).json({
    error: ehErroDoCliente ? err.message : 'Erro interno do servidor',
    message: err.message,
  });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Rota não encontrada' });
}
