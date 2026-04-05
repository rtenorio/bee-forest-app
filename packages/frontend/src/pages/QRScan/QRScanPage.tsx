import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeScanner } from '@/components/qr/QRCodeScanner';
import { useQRScan } from '@/hooks/useQRScan';

type ParsedQR =
  | { type: 'new'; codigo: string }
  | { type: 'old'; hiveLocalId: string }
  | null;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseQRResult(text: string): ParsedQR {
  const trimmed = text.trim();
  try {
    const url = new URL(trimmed);
    // Novo formato: https://beeforest.app/h/CME-001-ALD
    const newMatch = url.pathname.match(/^\/h\/([A-Za-z0-9_-]+)$/i);
    if (newMatch) return { type: 'new', codigo: newMatch[1] };
    // Formato legado: /hives/{uuid}
    const oldMatch = url.pathname.match(/^\/hives\/([0-9a-f-]{36})$/i);
    if (oldMatch) return { type: 'old', hiveLocalId: oldMatch[1] };
  } catch {
    // Não é URL — tenta formatos de caminho relativo
    const newMatch = trimmed.match(/^\/h\/([A-Za-z0-9_-]+)$/i);
    if (newMatch) return { type: 'new', codigo: newMatch[1] };
    const oldMatch = trimmed.match(/^\/hives\/([0-9a-f-]{36})$/i);
    if (oldMatch) return { type: 'old', hiveLocalId: oldMatch[1] };
    // Código bare impresso na etiqueta: CME-001-ALD (não é UUID, não tem espaço)
    if (/^[A-Za-z0-9_-]+$/.test(trimmed) && !UUID_RE.test(trimmed)) {
      return { type: 'new', codigo: trimmed };
    }
  }
  return null;
}

export function QRScanPage() {
  const navigate = useNavigate();
  const { recordScan } = useQRScan();
  const [active, setActive] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleScan = useCallback(
    async (text: string) => {
      if (!active) return;

      const parsed = parseQRResult(text);
      if (!parsed) {
        setError('QR Code não pertence a uma caixa de abelha. Tente novamente.');
        return;
      }

      setActive(false);
      setStatus('Identificando caixa...');

      try {
        if (parsed.type === 'new') {
          navigate(`/h/${parsed.codigo}`, { replace: true });
        } else {
          await recordScan(parsed.hiveLocalId);
          navigate(`/hives/${parsed.hiveLocalId}`, { replace: true });
        }
      } catch {
        setError('Erro ao processar QR Code. Tente novamente.');
        setActive(true);
        setStatus(null);
      }
    },
    [active, recordScan, navigate]
  );

  const handleCameraError = (err: string) => {
    setActive(false);
    setError(
      err.toLowerCase().includes('permission')
        ? 'Permissão de câmera negada. Habilite nas configurações do navegador.'
        : `Câmera indisponível: ${err}`
    );
  };

  const retry = () => {
    setError(null);
    setStatus(null);
    setActive(true);
  };

  return (
    <div className="min-h-screen bg-stone-950 flex flex-col items-center pt-10 px-4 gap-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <img src="/bee-icon.png" alt="Bee Forest" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
          <span className="font-bold text-amber-400 text-xl">Bee Forest</span>
        </div>
        <h1 className="text-lg font-semibold text-stone-100">Escanear QR Code</h1>
        <p className="text-sm text-stone-400 mt-1">
          Aponte a câmera para o código QR da caixa de abelha
        </p>
      </div>

      {/* Scanner com viewfinder */}
      {active && (
        <div className="relative w-full max-w-sm">
          {/* Cantos animados */}
          <div className="absolute inset-0 z-10 pointer-events-none" style={{ margin: '12px' }}>
            <span className="absolute top-0 left-0 w-7 h-7 border-t-[3px] border-l-[3px] border-amber-400 rounded-tl-md animate-pulse" />
            <span className="absolute top-0 right-0 w-7 h-7 border-t-[3px] border-r-[3px] border-amber-400 rounded-tr-md animate-pulse" />
            <span className="absolute bottom-0 left-0 w-7 h-7 border-b-[3px] border-l-[3px] border-amber-400 rounded-bl-md animate-pulse" />
            <span className="absolute bottom-0 right-0 w-7 h-7 border-b-[3px] border-r-[3px] border-amber-400 rounded-br-md animate-pulse" />
          </div>
          <QRCodeScanner onScan={handleScan} onError={handleCameraError} />
        </div>
      )}

      {/* Status */}
      {status && !error && (
        <div className="flex items-center gap-2 text-amber-400 text-sm animate-pulse">
          <span className="inline-block w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          {status}
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="bg-red-900/30 border border-red-700/40 rounded-xl px-4 py-3 max-w-xs">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
          <button
            onClick={retry}
            className="px-4 py-2 bg-amber-500/20 border border-amber-500/40 text-amber-400 rounded-lg text-sm hover:bg-amber-500/30 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Instrução */}
      {active && !error && (
        <p className="text-xs text-stone-500 text-center max-w-xs">
          Funciona offline — dados armazenados localmente se sem conexão
        </p>
      )}

      {/* Voltar */}
      <button
        onClick={() => navigate(-1)}
        className="text-stone-500 hover:text-stone-300 text-sm transition-colors mt-auto mb-8"
      >
        ← Voltar
      </button>
    </div>
  );
}
