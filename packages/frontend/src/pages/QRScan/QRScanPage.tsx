import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeScanner } from '@/components/qr/QRCodeScanner';
import { useQRScan } from '@/hooks/useQRScan';

function parseHiveLocalId(text: string): string | null {
  try {
    const url = new URL(text);
    const match = url.pathname.match(/^\/hives\/([0-9a-f-]{36})$/i);
    return match ? match[1] : null;
  } catch {
    const match = text.match(/^\/hives\/([0-9a-f-]{36})$/i);
    return match ? match[1] : null;
  }
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

      const hiveLocalId = parseHiveLocalId(text);
      if (!hiveLocalId) {
        setError('QR Code não pertence a uma colmeia. Tente novamente.');
        return;
      }

      setActive(false);
      setStatus('Registrando acesso...');

      try {
        await recordScan(hiveLocalId);
        navigate(`/hives/${hiveLocalId}`, { replace: true });
      } catch {
        setError('Erro ao registrar acesso. Tente novamente.');
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
    <div className="min-h-screen bg-stone-950 flex flex-col items-center pt-12 px-4 gap-6">
      {/* Header */}
      <div className="text-center">
        <div className="text-4xl mb-2">📷</div>
        <h1 className="text-xl font-bold text-stone-100">Escanear QR Code</h1>
        <p className="text-sm text-stone-400 mt-1">
          Aponte a câmera para o código QR da colmeia
        </p>
      </div>

      {/* Scanner */}
      {active && (
        <QRCodeScanner onScan={handleScan} onError={handleCameraError} />
      )}

      {/* Status / feedback */}
      {status && !error && (
        <p className="text-amber-400 text-sm animate-pulse">{status}</p>
      )}

      {error && (
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="bg-red-900/30 border border-red-700/40 rounded-xl px-4 py-3 max-w-xs">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
          <button
            onClick={retry}
            className="text-amber-400 hover:text-amber-300 text-sm underline transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="text-stone-500 hover:text-stone-300 text-sm transition-colors mt-auto mb-8"
      >
        ← Voltar
      </button>
    </div>
  );
}
