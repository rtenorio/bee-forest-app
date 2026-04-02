import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

interface Props {
  onScan: (text: string) => void;
  onError?: (err: string) => void;
}

export function QRCodeScanner({ onScan, onError }: Props) {
  // Stable element ID — avoids collision if the component mounts twice
  const elementId = useRef(`qr-reader-${Math.random().toString(36).slice(2)}`);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const scanner = new Html5Qrcode(elementId.current);
    scannerRef.current = scanner;

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => onScan(decoded),
        undefined // suppress per-frame not-found errors
      )
      .catch((err: unknown) => {
        onError?.(String(err));
      });

    return () => {
      startedRef.current = false;
      const s = scannerRef.current;
      if (s) {
        s.stop()
          .then(() => s.clear())
          .catch(() => {});
        scannerRef.current = null;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="w-full max-w-sm mx-auto">
      <div
        id={elementId.current}
        className="rounded-xl overflow-hidden"
      />
      <p className="text-xs text-stone-500 text-center mt-2">
        Posicione o QR Code dentro da área de leitura
      </p>
    </div>
  );
}
