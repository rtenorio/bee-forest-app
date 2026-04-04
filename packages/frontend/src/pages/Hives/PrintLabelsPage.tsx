import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { useApiaries } from '@/hooks/useApiaries';
import { useHives } from '@/hooks/useHives';
import type { Hive } from '@bee-forest/shared';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

const APP_URL = import.meta.env.VITE_APP_URL ?? 'https://beeforest.app';

function hiveQrUrl(hive: Hive) {
  return hive.qr_code ? `${APP_URL}/h/${hive.qr_code}` : `${window.location.origin}/hives/${hive.local_id}`;
}

interface LabelData {
  hive: Hive;
  dataUrl: string;
}

function QRLabel({ label, size = 160 }: { label: LabelData; size?: number }) {
  const code = label.hive.qr_code ?? label.hive.code;
  return (
    <div
      className="qr-label flex flex-col items-center justify-between bg-white border-2 border-amber-400 rounded-xl p-3"
      style={{ width: `${size}px`, height: `${size + 40}px`, flexShrink: 0 }}
    >
      {/* Header */}
      <div className="flex items-center gap-1">
        <span style={{ fontSize: '14px' }}>🐝</span>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', letterSpacing: '0.05em' }}>
          Bee Forest
        </span>
      </div>
      {/* QR Code */}
      <img
        src={label.dataUrl}
        alt={`QR ${code}`}
        style={{ width: `${size - 32}px`, height: `${size - 32}px` }}
      />
      {/* Código */}
      <p style={{
        fontSize: '10px',
        fontFamily: 'monospace',
        fontWeight: 700,
        color: '#1c1917',
        letterSpacing: '0.1em',
        textAlign: 'center',
      }}>
        {code}
      </p>
    </div>
  );
}

export function PrintLabelsPage() {
  const { data: apiaries = [] } = useApiaries();
  const [selectedApiary, setSelectedApiary] = useState<string>('');
  const { data: hives = [], isLoading: hivesLoading } = useHives(selectedApiary || undefined);

  const [labels, setLabels] = useState<LabelData[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Quando apiários carregam, seleciona o primeiro
  useEffect(() => {
    if (apiaries.length > 0 && !selectedApiary) {
      setSelectedApiary(apiaries[0].local_id);
    }
  }, [apiaries, selectedApiary]);

  // Gera QR codes quando colmeias mudam
  useEffect(() => {
    if (hives.length === 0) { setLabels([]); setSelected(new Set()); return; }
    setGenerating(true);
    Promise.all(
      hives.map(async (hive) => {
        const url = hiveQrUrl(hive);
        const dataUrl = await QRCode.toDataURL(url, {
          width: 200,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' },
        });
        return { hive, dataUrl };
      })
    )
      .then((results) => {
        setLabels(results);
        setSelected(new Set(results.map((r) => r.hive.local_id)));
      })
      .finally(() => setGenerating(false));
  }, [hives]);

  const toggleAll = useCallback(() => {
    if (selected.size === labels.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(labels.map((l) => l.hive.local_id)));
    }
  }, [selected, labels]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectedLabels = labels.filter((l) => selected.has(l.hive.local_id));

  const handlePrint = () => {
    window.print();
  };

  const handleExportPNG = useCallback((label: LabelData) => {
    const a = document.createElement('a');
    a.href = label.dataUrl;
    a.download = `qr-${label.hive.qr_code ?? label.hive.code}.png`;
    a.click();
  }, []);

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          .print-root { display: block !important; }
          .no-print { display: none !important; }
          .print-area {
            display: flex !important;
            flex-wrap: wrap;
            gap: 6mm;
            padding: 10mm;
            background: white;
          }
          .qr-label {
            width: 48mm !important;
            height: 54mm !important;
            page-break-inside: avoid;
            border: 1.5px solid #f59e0b !important;
            border-radius: 6px !important;
            background: white !important;
          }
        }
      `}</style>

      <div className="print-root space-y-5 max-w-5xl">
        {/* Controles — no-print */}
        <div className="no-print space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-stone-100">🏷️ Etiquetas QR Code</h1>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="text-xs text-stone-400 block mb-1">Meliponário</label>
              <select
                value={selectedApiary}
                onChange={(e) => setSelectedApiary(e.target.value)}
                className="bg-stone-800 border border-stone-700 text-stone-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              >
                <option value="">Todos</option>
                {apiaries.map((a) => (
                  <option key={a.local_id} value={a.local_id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-2">
              <Button variant="secondary" size="sm" onClick={toggleAll} disabled={labels.length === 0}>
                {selected.size === labels.length ? 'Desmarcar todas' : 'Selecionar todas'}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handlePrint}
                disabled={selectedLabels.length === 0}
              >
                🖨️ Imprimir ({selectedLabels.length})
              </Button>
              <Button
                size="sm"
                onClick={handlePrint}
                disabled={selectedLabels.length === 0}
              >
                📄 Exportar PDF
              </Button>
            </div>
          </div>

          {/* Seleção de caixas */}
          {(hivesLoading || generating) ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : labels.length === 0 ? (
            <p className="text-stone-500 text-sm py-4">Nenhuma colmeia encontrada.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto border border-stone-800 rounded-xl p-3 bg-stone-900/40">
              {labels.map((l) => (
                <label
                  key={l.hive.local_id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-stone-800 px-2 py-1.5 rounded-lg transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(l.hive.local_id)}
                    onChange={() => toggleOne(l.hive.local_id)}
                    className="accent-amber-500 w-4 h-4"
                  />
                  <span className="text-sm text-stone-300 font-mono">{l.hive.qr_code ?? l.hive.code}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); handleExportPNG(l); }}
                    className="ml-auto text-stone-600 hover:text-amber-400 text-xs transition-colors"
                    title="Baixar PNG"
                  >
                    ⬇
                  </button>
                </label>
              ))}
            </div>
          )}

          {/* Instruções */}
          <p className="text-xs text-stone-600">
            Dica: Use "Imprimir" ou "Exportar PDF" → o navegador abrirá o diálogo de impressão.
            Selecione "Salvar como PDF" para exportar. Formato otimizado para 4 etiquetas por linha em A4.
          </p>
        </div>

        {/* Preview (tela) */}
        {selectedLabels.length > 0 && (
          <div className="no-print">
            <p className="text-xs text-stone-500 uppercase tracking-wider mb-3 font-medium">
              Preview — {selectedLabels.length} etiqueta{selectedLabels.length !== 1 ? 's' : ''}
            </p>
            <div className="flex flex-wrap gap-3 p-4 bg-white/5 rounded-xl border border-stone-800">
              {selectedLabels.map((l) => (
                <QRLabel key={l.hive.local_id} label={l} size={150} />
              ))}
            </div>
          </div>
        )}

        {/* Área de impressão (escondida na tela, visível no print) */}
        <div className="print-area hidden">
          {selectedLabels.map((l) => (
            <QRLabel key={l.hive.local_id} label={l} size={150} />
          ))}
        </div>
      </div>
    </>
  );
}
