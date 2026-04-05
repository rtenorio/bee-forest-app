import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

const BASE = import.meta.env.VITE_API_URL ?? '';

interface TraceData {
  code: string;
  status: string;
  qr_code: string;
  installation_date: string | null;
  apiary_name: string | null;
  apiary_location: string | null;
  species_name: string | null;
  species_scientific_name: string | null;
  last_inspection: {
    inspected_at: string;
    inspector_name: string;
    overall_status: string | null;
  } | null;
  harvests: Array<{
    harvested_at: string;
    honey_type: string;
    brix: number | null;
    humidity_pct: number | null;
    total_volume_ml: number | null;
    maturation_status: string | null;
  }>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatShortDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const HONEY_TYPE_LABEL: Record<string, string> = {
  vivo: 'Mel Vivo',
  maturado: 'Mel Maturado',
};

const INSPECTION_LABEL: Record<string, { label: string; icon: string; desc: string; color: string }> = {
  healthy: {
    label: 'Colônia Saudável',
    icon: '✅',
    desc: 'Colônia inspecionada e certificada em bom estado de saúde.',
    color: 'text-emerald-400 border-emerald-700/50 bg-emerald-900/20',
  },
  attention: {
    label: 'Em Monitoramento',
    icon: '🔍',
    desc: 'Colônia sob monitoramento contínuo.',
    color: 'text-yellow-400 border-yellow-700/50 bg-yellow-900/20',
  },
  high_risk: {
    label: 'Em Tratamento',
    icon: '⚠️',
    desc: 'Colônia em processo de recuperação.',
    color: 'text-orange-400 border-orange-700/50 bg-orange-900/20',
  },
  critical: {
    label: 'Situação Crítica',
    icon: '🚨',
    desc: 'Colônia em situação crítica.',
    color: 'text-red-400 border-red-700/50 bg-red-900/20',
  },
};

export function TracePage() {
  const { codigo } = useParams<{ codigo: string }>();
  const [data, setData] = useState<TraceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!codigo) return;
    fetch(`${BASE}/api/public/hives/${encodeURIComponent(codigo)}`)
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); return; }
        if (!r.ok) throw new Error();
        setData(await r.json());
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [codigo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl">🍯</span>
          <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="text-5xl">🔍</span>
        <h1 className="text-xl font-bold text-stone-100">Produto não encontrado</h1>
        <p className="text-stone-400 text-sm max-w-xs">
          O código de rastreabilidade não foi encontrado. Verifique a embalagem.
        </p>
        <Link to="/" className="text-amber-400 text-sm hover:underline">← Bee Forest</Link>
      </div>
    );
  }

  const inspStatus = data.last_inspection?.overall_status
    ? INSPECTION_LABEL[data.last_inspection.overall_status]
    : null;
  const isCertified = data.last_inspection?.overall_status === 'healthy';
  const lastHarvest = data.harvests[0] ?? null;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      {/* Hero header */}
      <div className="bg-gradient-to-b from-amber-900/30 to-stone-950 border-b border-amber-900/30 px-4 py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <img src="/bee-icon.png" alt="Bee Forest" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
          <span className="font-bold text-amber-400 text-2xl">Bee Forest</span>
        </div>
        <h1 className="text-2xl font-bold text-stone-100 mb-1">Rastreabilidade do Mel</h1>
        <p className="text-stone-400 text-sm">Informações de origem e qualidade</p>
        <div className="mt-3 inline-block bg-stone-900/60 border border-stone-800 rounded-lg px-3 py-1.5">
          <span className="font-mono text-amber-400 text-sm tracking-widest">{data.qr_code}</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Origem */}
        <section className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-4">
            🏡 Origem
          </h2>
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <span className="text-xs text-stone-500">Meliponário</span>
              <span className="text-sm text-stone-200 font-medium text-right">
                {data.apiary_name ?? '—'}
              </span>
            </div>
            {data.apiary_location && (
              <div className="flex items-start justify-between">
                <span className="text-xs text-stone-500">Localização</span>
                <span className="text-sm text-stone-200 text-right">{data.apiary_location}</span>
              </div>
            )}
            {data.species_name && (
              <div className="flex items-start justify-between">
                <span className="text-xs text-stone-500">Espécie</span>
                <div className="text-right">
                  <p className="text-sm text-stone-200 font-medium">{data.species_name}</p>
                  {data.species_scientific_name && (
                    <p className="text-xs text-stone-500 italic">{data.species_scientific_name}</p>
                  )}
                </div>
              </div>
            )}
            <div className="flex items-start justify-between">
              <span className="text-xs text-stone-500">Caixa</span>
              <span className="text-sm text-stone-200">{data.code}</span>
            </div>
            {data.installation_date && (
              <div className="flex items-start justify-between">
                <span className="text-xs text-stone-500">Instalada em</span>
                <span className="text-sm text-stone-200">{formatDate(data.installation_date)}</span>
              </div>
            )}
          </div>
        </section>

        {/* Certificação de qualidade */}
        {inspStatus && (
          <section className={`border rounded-2xl p-5 ${inspStatus.color}`}>
            <h2 className="text-xs font-semibold uppercase tracking-wider mb-3 opacity-70">
              🔬 Certificação de Qualidade
            </h2>
            <div className="flex items-start gap-3">
              <span className="text-2xl">{inspStatus.icon}</span>
              <div>
                <p className="font-bold text-base">{inspStatus.label}</p>
                <p className="text-sm opacity-80 mt-0.5">{inspStatus.desc}</p>
                {data.last_inspection && (
                  <p className="text-xs opacity-60 mt-1.5">
                    Inspecionado em {formatDate(data.last_inspection.inspected_at)}
                    {data.last_inspection.inspector_name
                      ? ` por ${data.last_inspection.inspector_name}`
                      : ''}
                  </p>
                )}
              </div>
            </div>
            {isCertified && (
              <div className="mt-4 border-t border-emerald-700/30 pt-3 flex items-center gap-2">
                <span className="text-lg">🏅</span>
                <p className="text-xs text-emerald-400/80">
                  Mel de abelhas sem ferrão — produção artesanal e sustentável
                </p>
              </div>
            )}
          </section>
        )}

        {/* Última colheita */}
        {lastHarvest && (
          <section className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
            <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-4">
              🫙 Última Colheita
            </h2>
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <span className="text-xs text-stone-500">Data</span>
                <span className="text-sm text-stone-200 font-medium">
                  {formatDate(lastHarvest.harvested_at)}
                </span>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-xs text-stone-500">Tipo</span>
                <span className="text-sm text-stone-200">
                  {HONEY_TYPE_LABEL[lastHarvest.honey_type] ?? lastHarvest.honey_type}
                </span>
              </div>
              {lastHarvest.brix != null && (
                <div className="flex items-start justify-between">
                  <span className="text-xs text-stone-500">Concentração (Brix)</span>
                  <span className="text-sm text-amber-400 font-bold">{lastHarvest.brix}°</span>
                </div>
              )}
              {lastHarvest.humidity_pct != null && (
                <div className="flex items-start justify-between">
                  <span className="text-xs text-stone-500">Umidade</span>
                  <span className="text-sm text-stone-200">{lastHarvest.humidity_pct}%</span>
                </div>
              )}
              {lastHarvest.total_volume_ml != null && (
                <div className="flex items-start justify-between">
                  <span className="text-xs text-stone-500">Volume total</span>
                  <span className="text-sm text-stone-200">
                    {lastHarvest.total_volume_ml >= 1000
                      ? `${(lastHarvest.total_volume_ml / 1000).toFixed(1)}L`
                      : `${lastHarvest.total_volume_ml}ml`}
                  </span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Histórico de colheitas */}
        {data.harvests.length > 1 && (
          <section className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
            <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider mb-4">
              📅 Histórico de Colheitas
            </h2>
            <div className="space-y-2">
              {data.harvests.map((h, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2 border-b border-stone-800 last:border-0"
                >
                  <div>
                    <p className="text-sm text-stone-200">{formatShortDate(h.harvested_at)}</p>
                    <p className="text-xs text-stone-500">
                      {HONEY_TYPE_LABEL[h.honey_type] ?? h.honey_type}
                    </p>
                  </div>
                  <div className="text-right">
                    {h.brix != null && (
                      <p className="text-sm text-amber-400 font-medium">{h.brix}° Brix</p>
                    )}
                    {h.humidity_pct != null && (
                      <p className="text-xs text-stone-500">{h.humidity_pct}% umid.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="text-center pt-4 pb-6 space-y-2">
          <p className="text-stone-500 text-xs">
            Este QR Code garante a rastreabilidade completa do mel desde a caixa de abelha até você.
          </p>
          <div className="flex items-center justify-center gap-1.5">
            <img src="/bee-icon.png" alt="Bee Forest" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
            <span className="text-xs text-stone-600">Bee Forest · Meliponicultura sustentável</span>
          </div>
          <Link to={`/h/${data.qr_code}`} className="text-xs text-stone-600 hover:text-amber-400 transition-colors">
            Ver ficha da caixa de abelha →
          </Link>
        </div>
      </div>
    </div>
  );
}
