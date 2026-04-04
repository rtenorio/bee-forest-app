import { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { useApiaries } from '@/hooks/useApiaries';
import { useHives } from '@/hooks/useHives';
import type { Hive } from '@bee-forest/shared';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';

const APP_URL = import.meta.env.VITE_APP_URL ?? 'https://beeforest.app';
const LABELS_PER_PAGE = 12; // 3 colunas × 4 linhas

function hiveQrUrl(hive: Hive) {
  return hive.qr_code ? `${APP_URL}/h/${hive.qr_code}` : `${window.location.origin}/hives/${hive.local_id}`;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < arr.length; i += size) pages.push(arr.slice(i, i + size));
  return pages;
}

interface LabelData {
  hive: Hive;
  dataUrl: string;
}

// ─── Etiqueta individual ──────────────────────────────────────────────────────
// Usa apenas inline styles para garantir independência do dark mode em tela e print.

function QRLabel({ label }: { label: LabelData }) {
  const code = label.hive.qr_code ?? label.hive.code;
  return (
    <div
      className="qr-label"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#ffffff',
        border: '1.5px solid #f59e0b',
        borderRadius: '6px',
        padding: '6px',
        boxSizing: 'border-box',
        // Tamanho na tela (preview)
        width: '140px',
        height: '160px',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ fontSize: '13px' }}>🐝</span>
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#b45309', letterSpacing: '0.05em' }}>
          Bee Forest
        </span>
      </div>
      {/* QR Code */}
      <img
        src={label.dataUrl}
        alt={`QR ${code}`}
        style={{ width: '100px', height: '100px', display: 'block' }}
      />
      {/* Código */}
      <p style={{
        fontSize: '9px',
        fontFamily: 'monospace',
        fontWeight: 700,
        color: '#1c1917',
        letterSpacing: '0.08em',
        textAlign: 'center',
        margin: 0,
      }}>
        {code}
      </p>
    </div>
  );
}

// ─── Página de impressão (grupo de até 12 etiquetas) ─────────────────────────

function PrintPage({ labels, isLast }: { labels: LabelData[]; isLast: boolean }) {
  return (
    <div
      className="print-page"
      style={{ pageBreakAfter: isLast ? 'auto' : 'always', breakAfter: isLast ? 'auto' : 'page' }}
    >
      {labels.map((l) => (
        <QRLabel key={l.hive.local_id} label={l} />
      ))}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function PrintLabelsPage() {
  const { data: apiaries = [] } = useApiaries();
  const [selectedApiary, setSelectedApiary] = useState<string>('');
  const { data: hives = [], isLoading: hivesLoading } = useHives(selectedApiary || undefined);

  const [labels, setLabels] = useState<LabelData[]>([]);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (apiaries.length > 0 && !selectedApiary) {
      setSelectedApiary(apiaries[0].local_id);
    }
  }, [apiaries, selectedApiary]);

  useEffect(() => {
    if (hives.length === 0) { setLabels([]); setSelected(new Set()); return; }
    setGenerating(true);
    Promise.all(
      hives.map(async (hive) => {
        const dataUrl = await QRCode.toDataURL(hiveQrUrl(hive), {
          width: 300,
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
    setSelected(selected.size === labels.length
      ? new Set()
      : new Set(labels.map((l) => l.hive.local_id))
    );
  }, [selected, labels]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectedLabels = labels.filter((l) => selected.has(l.hive.local_id));
  const pages = chunk(selectedLabels, LABELS_PER_PAGE);

  const handlePrint = () => window.print();

  const handleExportPNG = useCallback((label: LabelData) => {
    const a = document.createElement('a');
    a.href = label.dataUrl;
    a.download = `qr-${label.hive.qr_code ?? label.hive.code}.png`;
    a.click();
  }, []);

  return (
    <>
      {/* ── Estilos de impressão ─────────────────────────────────────────── */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }

        @media print {
          /* Fundo branco absoluto — anula dark mode */
          html, body {
            background: white !important;
            background-color: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Força renderização de cores de fundo */
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Oculta toda a UI, exceto a área de impressão */
          .no-print { display: none !important; }

          /* Cada página: grid 3×4, tamanho A4 completo */
          .print-page {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            grid-template-rows: repeat(4, 1fr) !important;
            gap: 5mm !important;
            padding: 10mm !important;
            width: 210mm !important;
            height: 297mm !important;
            box-sizing: border-box !important;
            background: white !important;
          }

          /* Etiqueta dentro do grid — sobrescreve pixel sizes do preview */
          .print-page .qr-label {
            width: auto !important;
            height: auto !important;
            flex-shrink: 1 !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            background: white !important;
            border: 1px solid #f59e0b !important;
            border-radius: 4px !important;
          }

          /* QR image: preenche o espaço disponível */
          .print-page .qr-label img {
            width: 100% !important;
            height: auto !important;
            flex: 1 !important;
          }
        }
      `}</style>

      {/* ── Controles (tela) ─────────────────────────────────────────────── */}
      <div className="no-print space-y-5 max-w-5xl">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-stone-100">🏷️ Etiquetas QR Code</h1>
        </div>

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

          <div className="flex items-end gap-2 flex-wrap">
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

        {/* Lista de seleção */}
        {(hivesLoading || generating) ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : labels.length === 0 ? (
          <p className="text-stone-500 text-sm py-4">Nenhuma colmeia encontrada.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-52 overflow-y-auto border border-stone-800 rounded-xl p-3 bg-stone-900/40">
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
                <span className="text-sm text-stone-300 font-mono truncate">{l.hive.qr_code ?? l.hive.code}</span>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); handleExportPNG(l); }}
                  className="ml-auto text-stone-600 hover:text-amber-400 text-xs transition-colors shrink-0"
                  title="Baixar PNG"
                >
                  ⬇
                </button>
              </label>
            ))}
          </div>
        )}

        <p className="text-xs text-stone-600">
          {pages.length > 0
            ? `${selectedLabels.length} etiquetas · ${pages.length} página${pages.length !== 1 ? 's' : ''} A4 (3×4 por página)`
            : 'Selecione etiquetas para imprimir.'}
        </p>

        {/* Preview */}
        {selectedLabels.length > 0 && (
          <div>
            <p className="text-xs text-stone-500 uppercase tracking-wider mb-3 font-medium">
              Preview
            </p>
            <div className="flex flex-wrap gap-2 p-4 bg-white/5 rounded-xl border border-stone-800 max-h-[500px] overflow-y-auto">
              {selectedLabels.map((l) => (
                <QRLabel key={l.hive.local_id} label={l} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Área de impressão (oculta na tela, visível no print) ─────────── */}
      <div style={{ display: 'none' }}>
        {pages.map((page, i) => (
          <PrintPage key={i} labels={page} isLast={i === pages.length - 1} />
        ))}
      </div>
    </>
  );
}
