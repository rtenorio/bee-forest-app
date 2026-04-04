import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/Button';

interface Props {
  hiveLocalId: string;
  qrCodeText: string | null | undefined;
}

export function QRCodeDisplay({ hiveLocalId, qrCodeText }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  const appUrl = import.meta.env.VITE_APP_URL ?? window.location.origin;
  const qrContent = qrCodeText
    ? `${appUrl}/h/${qrCodeText}`
    : `${window.location.origin}/hives/${hiveLocalId}`;

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    QRCode.toCanvas(canvas, qrContent, {
      width: 240,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).catch(console.error);

    QRCode.toDataURL(qrContent, {
      width: 240,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    })
      .then(setDataUrl)
      .catch(console.error);
  }, [open, qrContent]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `qr-${qrCodeText ?? hiveLocalId.slice(0, 8)}.png`;
    a.click();
  };

  const handlePrint = () => {
    if (!dataUrl) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code — ${qrCodeText ?? ''}</title>
          <style>
            body { margin: 0; display: flex; flex-direction: column; align-items: center;
                   justify-content: center; min-height: 100vh; font-family: monospace; }
            h2 { font-size: 20px; margin-bottom: 8px; letter-spacing: 2px; }
            img { display: block; }
            p  { font-size: 11px; color: #555; margin-top: 6px; word-break: break-all; max-width: 260px; text-align: center; }
          </style>
        </head>
        <body>
          <h2>${qrCodeText ?? 'QR Code'}</h2>
          <img src="${dataUrl}" width="240" height="240" />
          <p>${qrContent}</p>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  return (
    <div className="border border-stone-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-stone-300 hover:text-stone-100 hover:bg-stone-800/60 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>📷</span>
          <span>QR Code{qrCodeText ? ` · ${qrCodeText}` : ''}</span>
        </span>
        <span className="text-stone-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 flex flex-col items-center gap-3 bg-stone-900/30">
          <canvas ref={canvasRef} className="rounded-lg bg-white p-2" />
          {qrCodeText && (
            <p className="text-xs text-stone-400 font-mono tracking-widest">{qrCodeText}</p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleDownload} disabled={!dataUrl}>
              ⬇ Baixar PNG
            </Button>
            <Button variant="secondary" size="sm" onClick={handlePrint} disabled={!dataUrl}>
              🖨 Imprimir
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
