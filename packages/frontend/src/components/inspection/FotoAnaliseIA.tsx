// packages/frontend/src/components/inspection/FotoAnaliseIA.tsx
// Componente de captura de fotos + análise por IA durante a inspeção

import React, { useRef, useState } from 'react';
import type { InspectionAIResult } from '../../types/inspection';
import { apiFetch } from '../../api/client';

interface FotoAnaliseIAProps {
  onResultado: (resultado: InspectionAIResult) => void;
  onFechar: () => void;
}

type EstadoAnalise = 'idle' | 'capturando_externa' | 'capturando_interna' | 'analisando' | 'concluido' | 'erro';

interface FotoCapturada {
  base64: string;
  mediaType: string;
  preview: string; // URL objeto para preview
}

export function FotoAnaliseIA({ onResultado, onFechar }: FotoAnaliseIAProps) {
  const [estado, setEstado] = useState<EstadoAnalise>('idle');
  const [fotoExterna, setFotoExterna] = useState<FotoCapturada | null>(null);
  const [fotoInterna, setFotoInterna] = useState<FotoCapturada | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [resultado, setResultado] = useState<InspectionAIResult | null>(null);

  const inputExternoCameraRef = useRef<HTMLInputElement>(null);
  const inputExternoGaleriaRef = useRef<HTMLInputElement>(null);
  const inputInternoCameraRef = useRef<HTMLInputElement>(null);
  const inputInternoGaleriaRef = useRef<HTMLInputElement>(null);

  // Converte File para base64
  async function fileParaBase64(file: File): Promise<FotoCapturada> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        // Separa o prefixo do base64 puro
        const base64 = dataUrl.split(',')[1];
        const mediaType = file.type || 'image/jpeg';
        resolve({
          base64,
          mediaType: mediaType as string,
          preview: dataUrl,
        });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleCapturarFoto(
    event: React.ChangeEvent<HTMLInputElement>,
    tipo: 'externa' | 'interna'
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const foto = await fileParaBase64(file);
      if (tipo === 'externa') {
        setFotoExterna(foto);
      } else {
        setFotoInterna(foto);
      }
    } catch {
      setErro('Erro ao processar a foto. Tente novamente.');
    }

    // Limpa o input para permitir nova captura
    event.target.value = '';
  }

  async function analisarFotos() {
    if (!fotoExterna && !fotoInterna) return;

    setEstado('analisando');
    setErro(null);

    try {
      const body: Record<string, string> = {};
      if (fotoExterna) {
        body.fotoExterna = fotoExterna.base64;
        body.fotoExternaType = fotoExterna.mediaType;
      }
      if (fotoInterna) {
        body.fotoInterna = fotoInterna.base64;
        body.fotoInternaType = fotoInterna.mediaType;
      }

      const json = await apiFetch<{ success: boolean; data: InspectionAIResult; error?: string }>(
        '/inspections/analyze-photos',
        { method: 'POST', body: JSON.stringify(body) },
      );

      if (!json.success) {
        throw new Error(json.error || 'Erro na análise.');
      }

      setResultado(json.data);
      setEstado('concluido');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao analisar as fotos.');
      setEstado('erro');
    }
  }

  function aplicarResultado() {
    if (resultado) {
      onResultado(resultado);
      onFechar();
    }
  }

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────

  return (
    <div
      style={{
        background: 'var(--color-background-primary)',
        borderRadius: 12,
        border: '1px solid var(--color-border-tertiary)',
        padding: 20,
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <p style={{ fontWeight: 500, fontSize: 15, margin: 0 }}>Análise por IA</p>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>
            Tire fotos da caixa para preencher a inspeção automaticamente
          </p>
        </div>
        <button
          type="button"
          onClick={onFechar}
          style={{
            background: 'none',
            border: 'none',
            fontSize: 20,
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
            padding: 4,
          }}
        >
          ×
        </button>
      </div>

      {/* Área de captura de fotos */}
      {estado !== 'concluido' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {/* Foto Externa */}
          <SlotFoto
            titulo="Foto Externa"
            placeholderEmoji="📷"
            placeholderTexto="Entrada da caixa"
            foto={fotoExterna}
            onAbrirCamera={() => inputExternoCameraRef.current?.click()}
            onAbrirGaleria={() => inputExternoGaleriaRef.current?.click()}
          />
          <input
            ref={inputExternoCameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => handleCapturarFoto(e, 'externa')}
          />
          <input
            ref={inputExternoGaleriaRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => handleCapturarFoto(e, 'externa')}
          />

          {/* Foto Interna */}
          <SlotFoto
            titulo="Foto Interna"
            placeholderEmoji="🐝"
            placeholderTexto="Interior da caixa"
            foto={fotoInterna}
            onAbrirCamera={() => inputInternoCameraRef.current?.click()}
            onAbrirGaleria={() => inputInternoGaleriaRef.current?.click()}
          />
          <input
            ref={inputInternoCameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => handleCapturarFoto(e, 'interna')}
          />
          <input
            ref={inputInternoGaleriaRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => handleCapturarFoto(e, 'interna')}
          />
        </div>
      )}

      {/* Estado: Analisando */}
      {estado === 'analisando' && (
        <div
          style={{
            textAlign: 'center',
            padding: '24px 0',
            color: 'var(--color-text-secondary)',
            fontSize: 14,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
          <p style={{ margin: 0 }}>Analisando as fotos...</p>
          <p style={{ fontSize: 12, margin: '4px 0 0', color: 'var(--color-text-secondary)' }}>
            Isso leva alguns segundos
          </p>
        </div>
      )}

      {/* Estado: Concluído — preview dos resultados */}
      {estado === 'concluido' && resultado && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontWeight: 500, fontSize: 14, marginBottom: 12, color: 'var(--color-text-success)' }}>
            ✓ Análise concluída
          </p>

          {/* Alertas */}
          {resultado.alertas && resultado.alertas.length > 0 && (
            <div
              style={{
                background: 'var(--color-background-warning)',
                border: '1px solid var(--color-border-warning)',
                borderRadius: 8,
                padding: '8px 12px',
                marginBottom: 12,
                fontSize: 12,
                color: 'var(--color-text-warning)',
              }}
            >
              {resultado.alertas.map((a, i) => (
                <p key={i} style={{ margin: i === 0 ? 0 : '4px 0 0' }}>
                  ⚠ {a}
                </p>
              ))}
            </div>
          )}

          {/* Observações da IA */}
          {resultado.observacoesIA && (
            <div
              style={{
                background: 'var(--color-background-info)',
                border: '1px solid var(--color-border-info)',
                borderRadius: 8,
                padding: '8px 12px',
                marginBottom: 12,
                fontSize: 12,
                color: 'var(--color-text-info)',
              }}
            >
              🤖 {resultado.observacoesIA}
            </div>
          )}

          {/* Resumo dos campos detectados */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              fontSize: 12,
            }}
          >
            {resultado.atividadeEntrada && (
              <CampoDetectado
                label="Atividade na entrada"
                valor={resultado.atividadeEntrada}
                confidence={resultado.confidence?.atividadeEntrada}
              />
            )}
            {resultado.densidadePopulacional && (
              <CampoDetectado
                label="Densidade pop."
                valor={resultado.densidadePopulacional}
                confidence={resultado.confidence?.densidadePopulacional}
              />
            )}
            {resultado.condicaoCaixa && (
              <CampoDetectado
                label="Condição da caixa"
                valor={resultado.condicaoCaixa}
                confidence={resultado.confidence?.condicaoCaixa}
              />
            )}
            {resultado.areaCria != null && (
              <CampoDetectado
                label="Área de cria"
                valor={`~${resultado.areaCria}%`}
                confidence={resultado.confidence?.areaCria}
              />
            )}
            {resultado.areaMel != null && (
              <CampoDetectado
                label="Área de mel"
                valor={`~${resultado.areaMel}%`}
                confidence={resultado.confidence?.areaMel}
              />
            )}
          </div>
        </div>
      )}

      {/* Erro */}
      {(estado === 'erro' || erro) && (
        <div
          style={{
            background: 'var(--color-background-danger)',
            border: '1px solid var(--color-border-danger)',
            borderRadius: 8,
            padding: '10px 12px',
            marginBottom: 16,
            fontSize: 13,
            color: 'var(--color-text-danger)',
          }}
        >
          {erro}
        </div>
      )}

      {/* Botões de ação */}
      <div style={{ display: 'flex', gap: 10 }}>
        {estado === 'concluido' ? (
          <>
            <button
              type="button"
              onClick={() => {
                setEstado('idle');
                setResultado(null);
              }}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 8,
                border: '1px solid var(--color-border-secondary)',
                background: 'var(--color-background-primary)',
                color: 'var(--color-text-primary)',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              Refazer
            </button>
            <button
              type="button"
              onClick={aplicarResultado}
              style={{
                flex: 2,
                padding: '10px 0',
                borderRadius: 8,
                border: 'none',
                background: 'var(--color-text-success)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Aplicar ao formulário ↗
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={analisarFotos}
            disabled={(!fotoExterna && !fotoInterna) || estado === 'analisando'}
            style={{
              flex: 1,
              padding: '12px 0',
              borderRadius: 8,
              border: 'none',
              background:
                (!fotoExterna && !fotoInterna) || estado === 'analisando'
                  ? 'var(--color-border-tertiary)'
                  : 'var(--color-text-info)',
              color: (!fotoExterna && !fotoInterna) || estado === 'analisando' ? 'var(--color-text-secondary)' : '#fff',
              fontSize: 14,
              fontWeight: 500,
              cursor:
                (!fotoExterna && !fotoInterna) || estado === 'analisando' ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {estado === 'analisando' ? 'Analisando...' : '🤖 Analisar fotos'}
          </button>
        )}
      </div>

      <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: 10 }}>
        As fotos ficam salvas no histórico da inspeção
      </p>
    </div>
  );
}

// Slot de foto com preview + dois botões (câmera / galeria)
function SlotFoto({
  titulo,
  placeholderEmoji,
  placeholderTexto,
  foto,
  onAbrirCamera,
  onAbrirGaleria,
}: {
  titulo: string;
  placeholderEmoji: string;
  placeholderTexto: string;
  foto: FotoCapturada | null;
  onAbrirCamera: () => void;
  onAbrirGaleria: () => void;
}) {
  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 6 }}>
        {titulo}
      </p>
      <div
        style={{
          width: '100%',
          aspectRatio: '1',
          borderRadius: 8,
          border: foto
            ? '2px solid var(--color-border-success)'
            : '1.5px dashed var(--color-border-secondary)',
          background: foto ? 'none' : 'var(--color-background-secondary)',
          overflow: 'hidden',
          position: 'relative',
          marginBottom: 6,
        }}
      >
        {foto ? (
          <img
            src={foto.preview}
            alt={titulo}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 6,
              padding: 12,
            }}
          >
            <span style={{ fontSize: 24 }}>{placeholderEmoji}</span>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', textAlign: 'center' }}>
              {placeholderTexto}
            </span>
          </div>
        )}
        {foto && (
          <div
            style={{
              position: 'absolute',
              bottom: 4,
              right: 4,
              background: 'var(--color-background-success)',
              borderRadius: 12,
              padding: '2px 6px',
              fontSize: 10,
              color: 'var(--color-text-success)',
              fontWeight: 500,
            }}
          >
            ✓ capturada
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <button
          type="button"
          onClick={onAbrirCamera}
          style={{
            flex: 1,
            padding: '6px 4px',
            borderRadius: 6,
            border: '1px solid var(--color-border-secondary)',
            background: 'var(--color-background-primary)',
            color: 'var(--color-text-primary)',
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
          }}
        >
          📷 Câmera
        </button>
        <button
          type="button"
          onClick={onAbrirGaleria}
          style={{
            flex: 1,
            padding: '6px 4px',
            borderRadius: 6,
            border: '1px solid var(--color-border-secondary)',
            background: 'var(--color-background-primary)',
            color: 'var(--color-text-primary)',
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
          }}
        >
          🖼️ Galeria
        </button>
      </div>
    </div>
  );
}

// Componente auxiliar para exibir campo detectado com badge de confiança
function CampoDetectado({
  label,
  valor,
  confidence,
}: {
  label: string;
  valor: string;
  confidence?: number;
}) {
  const pct = confidence != null ? Math.round(confidence * 100) : null;
  const corConfianca =
    pct == null ? 'secondary' : pct >= 80 ? 'success' : pct >= 50 ? 'warning' : 'danger';

  return (
    <div
      style={{
        background: 'var(--color-background-secondary)',
        borderRadius: 8,
        padding: '8px 10px',
      }}
    >
      <p style={{ margin: 0, fontSize: 11, color: 'var(--color-text-secondary)' }}>{label}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
          {valor}
        </p>
        {pct != null && (
          <span
            style={{
              fontSize: 10,
              background: `var(--color-background-${corConfianca})`,
              color: `var(--color-text-${corConfianca})`,
              borderRadius: 4,
              padding: '1px 5px',
            }}
          >
            {pct}%
          </span>
        )}
      </div>
    </div>
  );
}
