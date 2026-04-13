// packages/frontend/src/components/inspection/tabs/SanidadeTab.tsx
// Aba de Sanidade da inspeção — com pré-seleção de "Ausentes/Nenhum" e exclusão mútua

import React from 'react';
import {
  INVASORES_OPCOES,
  SINAIS_ENFRAQUECIMENTO_OPCOES,
  ALTERACOES_INTERNAS_OPCOES,
  toggleInvasores,
  toggleSinaisEnfraquecimento,
  toggleAlteracoesInternas,
} from '@bee-forest/shared';

interface SanidadeTabProps {
  values: {
    invasores: string[];
    sinaisEnfraquecimento: string[];
    alteracoesInternas: string[];
    observacoesSanidade?: string;
  };
  onChange: (field: string, value: unknown) => void;
  // Campos sugeridos pela IA (opcional)
  aiSuggestions?: {
    invasores?: string[];
    sinaisEnfraquecimento?: string[];
    alteracoesInternas?: string[];
    confidence?: Record<string, number>;
  };
}

// Chip de opção com estilo diferenciado para "neutro" (ausente/nenhum) vs item real
function OpcaoChip({
  label,
  value,
  checked,
  neutro,
  aiSugerido,
  onToggle,
}: {
  label: string;
  value: string;
  checked: boolean;
  neutro?: boolean;
  aiSugerido?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 14px',
        borderRadius: 20,
        border: checked
          ? neutro
            ? '1.5px solid var(--color-border-success)'
            : '1.5px solid var(--color-border-danger)'
          : '1px solid var(--color-border-tertiary)',
        background: checked
          ? neutro
            ? 'var(--color-background-success)'
            : 'var(--color-background-danger)'
          : 'var(--color-background-primary)',
        color: checked
          ? neutro
            ? 'var(--color-text-success)'
            : 'var(--color-text-danger)'
          : 'var(--color-text-secondary)',
        fontSize: 13,
        fontWeight: checked ? 500 : 400,
        cursor: 'pointer',
        transition: 'all 0.15s',
        position: 'relative',
      }}
    >
      {checked && (
        <span style={{ fontSize: 12 }}>{neutro ? '✓' : '!'}</span>
      )}
      {label}
      {aiSugerido && !checked && (
        <span
          style={{
            fontSize: 10,
            background: 'var(--color-background-info)',
            color: 'var(--color-text-info)',
            borderRadius: 4,
            padding: '1px 5px',
            marginLeft: 2,
          }}
        >
          IA
        </span>
      )}
    </button>
  );
}

function SecaoMultiSelect({
  titulo,
  descricao,
  opcoes,
  valores,
  onToggle,
  aiSugestoes,
}: {
  titulo: string;
  descricao?: string;
  opcoes: ReadonlyArray<{ value: string; label: string }>;
  valores: string[];
  onToggle: (valor: string) => void;
  aiSugestoes?: string[];
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
          {titulo}
        </span>
        {descricao && (
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginLeft: 8 }}>
            {descricao}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {opcoes.map((opcao) => {
          const ehNeutro = ['ausentes', 'nenhum', 'nenhuma'].includes(opcao.value);
          const aiSugerido = aiSugestoes?.includes(opcao.value) && !valores.includes(opcao.value);
          return (
            <OpcaoChip
              key={opcao.value}
              label={opcao.label}
              value={opcao.value}
              checked={valores.includes(opcao.value)}
              neutro={ehNeutro}
              aiSugerido={aiSugerido}
              onToggle={() => onToggle(opcao.value)}
            />
          );
        })}
      </div>
    </div>
  );
}

export function SanidadeTab({ values, onChange, aiSuggestions }: SanidadeTabProps) {
  const handleInvasores = (valor: string) => {
    onChange('invasores', toggleInvasores(values.invasores, valor));
  };

  const handleSinaisEnfraquecimento = (valor: string) => {
    onChange('sinaisEnfraquecimento', toggleSinaisEnfraquecimento(values.sinaisEnfraquecimento, valor));
  };

  const handleAlteracoesInternas = (valor: string) => {
    onChange('alteracoesInternas', toggleAlteracoesInternas(values.alteracoesInternas, valor));
  };

  const temAlerta =
    !values.invasores.includes('ausentes') ||
    !values.sinaisEnfraquecimento.includes('nenhum') ||
    !values.alteracoesInternas.includes('nenhuma');

  return (
    <div style={{ padding: '16px 0' }}>
      {/* Banner de alerta se algum problema foi marcado */}
      {temAlerta && (
        <div
          style={{
            background: 'var(--color-background-warning)',
            border: '1px solid var(--color-border-warning)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 20,
            fontSize: 13,
            color: 'var(--color-text-warning)',
          }}
        >
          ⚠ Atenção: problemas de sanidade identificados nesta inspeção.
        </div>
      )}

      {/* Sugestão de IA ativa */}
      {aiSuggestions && (
        <div
          style={{
            background: 'var(--color-background-info)',
            border: '1px solid var(--color-border-info)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 20,
            fontSize: 13,
            color: 'var(--color-text-info)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>🤖</span>
          <span>Sugestões da IA destacadas com a tag <strong>IA</strong>. Toque para aceitar.</span>
        </div>
      )}

      <SecaoMultiSelect
        titulo="Invasores e predadores"
        descricao="Selecione todos que estiverem presentes"
        opcoes={INVASORES_OPCOES}
        valores={values.invasores}
        onToggle={handleInvasores}
        aiSugestoes={aiSuggestions?.invasores}
      />

      <SecaoMultiSelect
        titulo="Sinais de enfraquecimento"
        descricao="Selecione todos que forem observados"
        opcoes={SINAIS_ENFRAQUECIMENTO_OPCOES}
        valores={values.sinaisEnfraquecimento}
        onToggle={handleSinaisEnfraquecimento}
        aiSugestoes={aiSuggestions?.sinaisEnfraquecimento}
      />

      <SecaoMultiSelect
        titulo="Alterações internas"
        descricao="Selecione todas as alterações observadas"
        opcoes={ALTERACOES_INTERNAS_OPCOES}
        valores={values.alteracoesInternas}
        onToggle={handleAlteracoesInternas}
        aiSugestoes={aiSuggestions?.alteracoesInternas}
      />

      <div style={{ marginTop: 8 }}>
        <label style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', display: 'block', marginBottom: 8 }}>
          Observações de sanidade
        </label>
        <textarea
          value={values.observacoesSanidade || ''}
          onChange={(e) => onChange('observacoesSanidade', e.target.value)}
          placeholder="Descreva qualquer detalhe adicional sobre a sanidade da colônia..."
          rows={3}
          style={{
            width: '100%',
            fontSize: 14,
            borderRadius: 8,
            border: '1px solid var(--color-border-tertiary)',
            padding: '10px 12px',
            background: 'var(--color-background-primary)',
            color: 'var(--color-text-primary)',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      </div>
    </div>
  );
}
