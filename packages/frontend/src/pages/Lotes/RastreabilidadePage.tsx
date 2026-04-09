import { useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useLotePublic } from '@/hooks/useLotes';

const ETAPA_LABEL: Record<string, string> = {
  desumidificacao: 'Desumidificação',
  maturacao:       'Maturação',
  envase:          'Envase',
  analise:         'Análise de Qualidade',
  outro:           'Outro',
};

const STATUS_LABEL: Record<string, string> = {
  coletado:        'Coletado',
  desumidificando: 'Desumidificando',
  maturando:       'Maturando',
  envasado:        'Envasado',
  vendido:         'Vendido',
};

function formatDate(d: string) {
  return format(new Date(d + 'T12:00:00'), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function RastreabilidadePage() {
  const { local_id } = useParams<{ local_id: string }>();
  const { data, isLoading, isError } = useLotePublic(local_id ?? '');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">🐝</div>
          <p className="text-stone-500 text-sm">Carregando rastreabilidade…</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center px-4">
          <div className="text-5xl mb-4">🍯</div>
          <h1 className="text-xl font-bold text-stone-800 mb-2">Lote não encontrado</h1>
          <p className="text-stone-500 text-sm">O código de rastreabilidade não corresponde a nenhum lote.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="bg-amber-500 text-white shadow-md">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center gap-3">
          <img src="/bee-icon.png" alt="Bee Forest" className="h-10 w-auto" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div>
            <p className="text-xs font-medium text-amber-100 uppercase tracking-widest">Bee Forest</p>
            <h1 className="text-lg font-bold leading-tight">Rastreabilidade do Mel</h1>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Lote ID card */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5">
          <p className="text-xs text-stone-500 uppercase tracking-widest font-medium mb-1">Código do lote</p>
          <p className="text-3xl font-bold text-amber-600 font-mono tracking-wide">{data.codigo}</p>
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
              {STATUS_LABEL[data.status] ?? data.status}
            </span>
            <span className="text-xs text-stone-400">{data.volume_total_ml} ml produzidos</span>
          </div>
        </div>

        {/* Origin */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide">Origem</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-stone-400 mb-0.5">Meliponário</p>
              <p className="font-medium text-stone-800">{data.apiary_nome}</p>
            </div>
            <div>
              <p className="text-xs text-stone-400 mb-0.5">Localização</p>
              <p className="font-medium text-stone-800">{data.apiary_localizacao || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-stone-400 mb-0.5">Data da colheita</p>
              <p className="font-medium text-stone-800">{formatDate(data.data_colheita)}</p>
            </div>
            {(data.umidade != null || data.brix != null) && (
              <div>
                <p className="text-xs text-stone-400 mb-0.5">Qualidade</p>
                <p className="font-medium text-stone-800">
                  {data.umidade != null ? `Umidade ${data.umidade}%` : ''}
                  {data.umidade != null && data.brix != null ? ' · ' : ''}
                  {data.brix != null ? `Brix ${data.brix}%` : ''}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Colmeias de origem */}
        {data.colmeias_origem.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5">
            <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-3">
              Colmeias de origem ({data.colmeias_origem.length})
            </h2>
            <div className="space-y-2">
              {data.colmeias_origem.map((c, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5 border-b border-stone-100 last:border-0">
                  <span className="text-lg">🐝</span>
                  <div>
                    <p className="text-sm font-medium text-stone-800">{c.hive_code}</p>
                    {c.especie && <p className="text-xs text-stone-400">{c.especie}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Etapas de processamento */}
        {data.etapas.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5">
            <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-4">
              Etapas de processamento
            </h2>
            <div className="relative">
              {/* Connecting line */}
              <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-amber-200" />
              <div className="space-y-5">
                {data.etapas.map((e, i) => (
                  <div key={i} className="flex gap-4 relative">
                    <div className="w-6 h-6 rounded-full bg-amber-500 border-2 border-white shadow flex-shrink-0 flex items-center justify-center z-10">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                    <div className="pb-1">
                      <p className="text-sm font-semibold text-stone-800">{ETAPA_LABEL[e.tipo] ?? e.tipo}</p>
                      <p className="text-xs text-stone-400 mt-0.5">
                        {formatDate(e.data_inicio)}
                        {e.data_fim ? ` → ${formatDate(e.data_fim)}` : ' (em andamento)'}
                      </p>
                      {e.responsavel_nome && (
                        <p className="text-xs text-stone-500 mt-0.5">Responsável: {e.responsavel_nome}</p>
                      )}
                      {e.observacao && (
                        <p className="text-xs text-stone-500 mt-1 italic">"{e.observacao}"</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Certification */}
        <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5 text-center">
          <div className="text-3xl mb-2">🏆</div>
          <p className="text-sm font-semibold text-amber-900 leading-snug">
            Este mel foi produzido com rastreabilidade completa pela Bee Forest
          </p>
          <p className="text-xs text-amber-700 mt-1.5">
            Cada etapa do processo é registrada, garantindo qualidade e transparência.
          </p>
        </div>

        <footer className="text-center py-4">
          <p className="text-xs text-stone-400">© Bee Forest · Meliponicultura com propósito</p>
        </footer>
      </main>
    </div>
  );
}
