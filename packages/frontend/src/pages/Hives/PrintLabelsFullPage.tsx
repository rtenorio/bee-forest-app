import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { useHives } from '@/hooks/useHives';
import { Spinner } from '@/components/ui/Spinner';
import type { Hive } from '@bee-forest/shared';

const APP_URL = import.meta.env.VITE_APP_URL ?? 'https://beeforest.app';
const LABELS_PER_PAGE = 12; // 3 colunas × 4 linhas

function hiveQrUrl(hive: Hive) {
  return hive.qr_code
    ? `${APP_URL}/h/${hive.qr_code}`
    : `${window.location.origin}/hives/${hive.local_id}`;
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

function QRLabel({ label }: { label: LabelData }) {
  const code = label.hive.qr_code ?? label.hive.code;
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: '#ffffff',
      border: '1.5px solid #f59e0b',
      borderRadius: '6px',
      padding: '6px',
      boxSizing: 'border-box',
      width: '140px',
      height: '160px',
      flexShrink: 0,
    }}>
      <div style={{ background: '#fff', borderRadius: '4px', padding: '1px 4px', display: 'inline-flex' }}>
        <img
          src="/logo-bee-forest.jpg"
          alt="Bee Forest"
          style={{ height: '20px', objectFit: 'contain', display: 'block' }}
        />
      </div>
      <img
        src={label.dataUrl}
        alt={`QR ${code}`}
        style={{ width: '100px', height: '100px', display: 'block' }}
      />
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

export function PrintLabelsFullPage() {
  const [searchParams] = useSearchParams();
  const ids = searchParams.get('ids')?.split(',').filter(Boolean) ?? [];

  const { data: allHives = [], isLoading: hivesLoading } = useHives();
  const hives = allHives.filter((h) => ids.includes(h.local_id));

  const [labels, setLabels] = useState<LabelData[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (hives.length === 0) { setLabels([]); return; }
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
      .then(setLabels)
      .finally(() => setGenerating(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allHives, ids.join(',')]);

  const pages = chunk(labels, LABELS_PER_PAGE);
  const loading = hivesLoading || generating;

  return (
    <div style={{ background: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: #fff; }
          .label-page { page-break-after: always; break-after: page; }
          .label-page:last-child { page-break-after: auto; break-after: auto; }
        }
      `}</style>

      {/* Controles — ocultados na impressão */}
      <div className="no-print" style={{
        padding: '16px 24px',
        borderBottom: '1px solid #e7e5e4',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: '#fafaf9',
      }}>
        <img
          src="/logo-bee-forest.jpg"
          alt="Bee Forest"
          style={{ height: '32px', objectFit: 'contain' }}
        />
        <span style={{ fontSize: '14px', color: '#44403c', fontWeight: 600 }}>
          Etiquetas QR Code
        </span>
        <span style={{ fontSize: '12px', color: '#78716c', marginLeft: 'auto' }}>
          {labels.length} etiqueta{labels.length !== 1 ? 's' : ''} · {pages.length} página{pages.length !== 1 ? 's' : ''} A4
        </span>
        <button
          onClick={() => window.print()}
          disabled={labels.length === 0}
          style={{
            background: '#f59e0b',
            color: '#1c1917',
            border: 'none',
            borderRadius: '8px',
            padding: '8px 20px',
            fontWeight: 700,
            fontSize: '13px',
            cursor: labels.length === 0 ? 'not-allowed' : 'pointer',
            opacity: labels.length === 0 ? 0.5 : 1,
          }}
        >
          🖨️ Imprimir / Exportar PDF
        </button>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="no-print" style={{ display: 'flex', justifyContent: 'center', padding: '64px' }}>
          <Spinner />
        </div>
      ) : labels.length === 0 ? (
        <div className="no-print" style={{ textAlign: 'center', padding: '64px', color: '#78716c' }}>
          Nenhuma etiqueta encontrada para os IDs informados.
        </div>
      ) : (
        pages.map((page, i) => (
          <div
            key={i}
            className="label-page"
            style={{
              padding: '16mm 14mm',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              justifyContent: 'flex-start',
              alignContent: 'flex-start',
              minHeight: '277mm',
              boxSizing: 'border-box',
            }}
          >
            {page.map((l) => (
              <QRLabel key={l.hive.local_id} label={l} />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
