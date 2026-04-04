import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { useQRScan } from '@/hooks/useQRScan';
import { hiveRepo } from '@/db/repositories/hive.repository';
import { apiaryRepo } from '@/db/repositories/apiary.repository';

const BASE = import.meta.env.VITE_API_URL ?? '';

interface HivePublicData {
  local_id: string;
  code: string;
  status: string;
  box_type: string;
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
  }>;
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:      { label: 'Ativa',        color: 'text-emerald-400 bg-emerald-900/30 border-emerald-700/40' },
  inactive:    { label: 'Inativa',      color: 'text-stone-400 bg-stone-800/60 border-stone-700/40' },
  dead:        { label: 'Morta',        color: 'text-red-400 bg-red-900/30 border-red-700/40' },
  transferred: { label: 'Transferida',  color: 'text-blue-400 bg-blue-900/30 border-blue-700/40' },
};

const INSPECTION_STATUS: Record<string, { icon: string; label: string; color: string }> = {
  healthy:   { icon: '🟢', label: 'Saudável',   color: 'text-emerald-400' },
  attention: { icon: '🟡', label: 'Atenção',     color: 'text-yellow-400' },
  high_risk: { icon: '🟠', label: 'Alto Risco',  color: 'text-orange-400' },
  critical:  { icon: '🔴', label: 'Crítica',     color: 'text-red-400' },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function HiveLandingPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { recordScan } = useQRScan();

  const [data, setData] = useState<HivePublicData | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [scanRecorded, setScanRecorded] = useState(false);

  useEffect(() => {
    if (!codigo) return;

    fetch(`${BASE}/api/public/hives/${encodeURIComponent(codigo)}`)
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); return; }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setData(await r.json());
      })
      .catch(async () => {
        // Offline: tenta IDB (apenas se logado)
        if (user) {
          const hives = await hiveRepo.getAll();
          const needle = codigo.toLowerCase();
          const hive = hives.find(
            (h) => h.qr_code?.toLowerCase() === needle || h.code?.toLowerCase() === needle
          );
          if (hive) {
            setOffline(true);
            const apiary = await apiaryRepo.getById(hive.apiary_local_id);
            setData({
              local_id: hive.local_id,
              code: hive.code,
              status: hive.status,
              box_type: hive.box_type,
              qr_code: hive.qr_code ?? codigo,
              installation_date: hive.installation_date,
              apiary_name: apiary?.name ?? null,
              apiary_location: apiary?.location ?? null,
              species_name: null,
              species_scientific_name: null,
              last_inspection: null,
              harvests: [],
            });
          } else {
            setNotFound(true);
          }
        } else {
          setNotFound(true);
        }
      })
      .finally(() => setLoading(false));
  }, [codigo, user]);

  // Registra scan quando dados carregam (somente se logado)
  useEffect(() => {
    if (data && user && !scanRecorded) {
      setScanRecorded(true);
      recordScan(data.local_id).catch(() => {});
    }
  }, [data, user, scanRecorded, recordScan]);

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="text-4xl">🐝</span>
          <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-stone-400 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <span className="text-5xl">🔍</span>
        <h1 className="text-xl font-bold text-stone-100">Caixa não encontrada</h1>
        <p className="text-stone-400 text-sm max-w-xs">
          O QR Code escaneado não corresponde a nenhuma caixa registrada no Bee Forest.
        </p>
        <Link to="/" className="text-amber-400 text-sm hover:underline">← Ir para o app</Link>
      </div>
    );
  }

  if (!data) return null;

  const statusInfo = STATUS_LABEL[data.status] ?? STATUS_LABEL['active'];
  const inspStatus = data.last_inspection?.overall_status
    ? INSPECTION_STATUS[data.last_inspection.overall_status]
    : null;
  const lastHarvest = data.harvests[0] ?? null;

  const needsAlert =
    !data.last_inspection ||
    data.last_inspection.overall_status === 'high_risk' ||
    data.last_inspection.overall_status === 'critical';

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 pb-12">
      {/* Header */}
      <div className="bg-stone-900 border-b border-stone-800 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🐝</span>
          <span className="font-bold text-amber-400 text-lg">Bee Forest</span>
        </div>
        {user ? (
          <button
            onClick={() => navigate(-1)}
            className="text-stone-400 hover:text-stone-200 text-sm transition-colors"
          >
            ← Voltar
          </button>
        ) : (
          <Link to="/login" className="text-amber-400 text-sm hover:underline">Entrar</Link>
        )}
      </div>

      <div className="max-w-md mx-auto px-4 pt-6 space-y-4">
        {/* Offline notice */}
        {offline && (
          <div className="bg-yellow-900/30 border border-yellow-700/40 rounded-xl px-4 py-2 text-yellow-300 text-xs text-center">
            Dados carregados offline — informações podem estar desatualizadas
          </div>
        )}

        {/* Identidade da caixa */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-stone-500 font-mono tracking-widest mb-1">{data.qr_code}</p>
              <h1 className="text-2xl font-bold text-stone-100">{data.code}</h1>
              {data.apiary_name && (
                <p className="text-sm text-stone-400 mt-0.5">
                  {data.apiary_name}
                  {data.apiary_location ? ` · ${data.apiary_location}` : ''}
                </p>
              )}
              {data.species_name && (
                <p className="text-xs text-stone-500 mt-0.5 italic">
                  {data.species_name}
                  {data.species_scientific_name ? ` (${data.species_scientific_name})` : ''}
                </p>
              )}
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>

          {data.installation_date && (
            <p className="text-xs text-stone-600 mt-3">
              Instalada em {formatDate(data.installation_date)}
              {data.box_type ? ` · ${data.box_type}` : ''}
            </p>
          )}
        </div>

        {/* Alerta */}
        {needsAlert && (
          <div className="bg-orange-900/30 border border-orange-700/40 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-xl mt-0.5">⚠️</span>
            <div>
              <p className="text-orange-300 font-medium text-sm">
                {!data.last_inspection
                  ? 'Sem inspeções registradas'
                  : 'Status requer atenção'}
              </p>
              <p className="text-orange-400/70 text-xs mt-0.5">
                {!data.last_inspection
                  ? 'Esta caixa ainda não foi inspecionada.'
                  : `Última inspeção: ${inspStatus?.label ?? 'Atenção'}`}
              </p>
            </div>
          </div>
        )}

        {/* Última inspeção */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">
            Última Inspeção
          </p>
          {data.last_inspection ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-stone-200 font-medium">
                  {formatDate(data.last_inspection.inspected_at)}
                </p>
                {data.last_inspection.inspector_name && (
                  <p className="text-xs text-stone-500 mt-0.5">
                    por {data.last_inspection.inspector_name}
                  </p>
                )}
              </div>
              {inspStatus && (
                <div className="text-right">
                  <p className={`font-bold text-sm ${inspStatus.color}`}>
                    {inspStatus.icon} {inspStatus.label}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-stone-500 text-sm">Nenhuma inspeção registrada</p>
          )}
        </div>

        {/* Última colheita */}
        {lastHarvest && (
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-3">
              Última Colheita
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-stone-200 font-medium">{formatDate(lastHarvest.harvested_at)}</p>
                <p className="text-xs text-stone-500 capitalize mt-0.5">
                  Mel {lastHarvest.honey_type === 'vivo' ? 'vivo' : 'maturado'}
                </p>
              </div>
              <div className="text-right space-y-1">
                {lastHarvest.brix != null && (
                  <p className="text-amber-400 text-sm font-bold">{lastHarvest.brix}° Brix</p>
                )}
                {lastHarvest.humidity_pct != null && (
                  <p className="text-stone-400 text-xs">{lastHarvest.humidity_pct}% umidade</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Ações rápidas */}
        {user ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">
              Ações Rápidas
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => navigate(`/inspections/new?hive=${data.local_id}`)}
                className="flex flex-col items-center gap-1.5 px-3 py-4 bg-stone-900 border border-stone-800 rounded-xl hover:border-amber-500/50 hover:bg-amber-500/5 transition-colors text-center"
              >
                <span className="text-2xl">🔍</span>
                <span className="text-xs text-stone-300 font-medium">Nova Inspeção</span>
              </button>
              <button
                onClick={() => navigate(`/hives/${data.local_id}`)}
                className="flex flex-col items-center gap-1.5 px-3 py-4 bg-stone-900 border border-stone-800 rounded-xl hover:border-amber-500/50 hover:bg-amber-500/5 transition-colors text-center"
              >
                <span className="text-2xl">📋</span>
                <span className="text-xs text-stone-300 font-medium">Histórico Completo</span>
              </button>
              {(user.role === 'socio' || user.role === 'responsavel') && (
                <>
                  <button
                    onClick={() => navigate(`/harvests/new?hive=${data.local_id}`)}
                    className="flex flex-col items-center gap-1.5 px-3 py-4 bg-stone-900 border border-stone-800 rounded-xl hover:border-amber-500/50 hover:bg-amber-500/5 transition-colors text-center"
                  >
                    <span className="text-2xl">🫙</span>
                    <span className="text-xs text-stone-300 font-medium">Registrar Colheita</span>
                  </button>
                  <Link
                    to={`/trace/${data.qr_code}`}
                    className="flex flex-col items-center gap-1.5 px-3 py-4 bg-stone-900 border border-stone-800 rounded-xl hover:border-amber-500/50 hover:bg-amber-500/5 transition-colors text-center"
                  >
                    <span className="text-2xl">🌿</span>
                    <span className="text-xs text-stone-300 font-medium">Rastreabilidade</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 text-center space-y-3">
            <p className="text-stone-400 text-sm">
              Faça login para registrar inspeções, colheitas e acessar o histórico completo.
            </p>
            <Link
              to="/login"
              className="inline-block px-5 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold rounded-lg text-sm transition-colors"
            >
              Entrar no Bee Forest
            </Link>
          </div>
        )}

        {/* Rastreabilidade pública */}
        <div className="text-center pt-2">
          <Link
            to={`/trace/${data.qr_code}`}
            className="text-xs text-stone-500 hover:text-amber-400 transition-colors"
          >
            🌿 Ver rastreabilidade pública do mel
          </Link>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-stone-700 pb-2">
          Bee Forest · Meliponicultura sustentável
        </p>
      </div>
    </div>
  );
}
