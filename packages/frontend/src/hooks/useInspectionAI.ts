// packages/frontend/src/hooks/useInspectionAI.ts
// Hook que integra o resultado da análise de fotos ao estado do formulário de inspeção

import { useCallback } from 'react';
import type { InspectionAIResult } from '../types/inspection';

// Limiar de confiança para auto-preencher vs. só sugerir
const THRESHOLD_AUTO = 0.80;
const THRESHOLD_SUGESTAO = 0.50;

export interface AIApplicationResult {
  // Campos que foram aplicados automaticamente (confiança >= 80%)
  aplicados: string[];
  // Campos que foram sugeridos mas não aplicados (confiança entre 50-80%)
  sugeridos: string[];
  // Campos ignorados por baixa confiança
  ignorados: string[];
}

/**
 * Aplica o resultado da IA ao formulário de inspeção.
 * Campos com confiança >= 80% são preenchidos automaticamente.
 * Campos entre 50-80% ficam como sugestão (badge "IA" no chip).
 * Abaixo de 50% são ignorados.
 */
export function useInspectionAI(
  setFieldValue: (field: string, value: unknown) => void
) {
  const aplicarResultadoIA = useCallback(
    (resultado: InspectionAIResult): AIApplicationResult => {
      const aplicados: string[] = [];
      const sugeridos: string[] = [];
      const ignorados: string[] = [];

      const conf = resultado.confidence || {};

      // Helper para aplicar ou sugerir
      function processarCampo(
        campo: string,
        valor: unknown,
        confidence: number | undefined
      ) {
        const c = confidence ?? 0;
        if (valor == null) {
          ignorados.push(campo);
          return;
        }
        if (c >= THRESHOLD_AUTO) {
          setFieldValue(campo, valor);
          aplicados.push(campo);
        } else if (c >= THRESHOLD_SUGESTAO) {
          // Para sugestões, armazenamos em um campo _aiSuggestion_X
          // O componente de formulário lê esse campo para exibir o badge
          setFieldValue(`_aiSuggestion_${campo}`, valor);
          sugeridos.push(campo);
        } else {
          ignorados.push(campo);
        }
      }

      // Campos simples
      processarCampo('atividadeEntrada', resultado.atividadeEntrada, conf.atividadeEntrada);
      processarCampo('densidadePopulacional', resultado.densidadePopulacional, conf.densidadePopulacional);
      processarCampo('areaTotal', resultado.areaTotal, conf.areaTotal);
      processarCampo('areaCria', resultado.areaCria, conf.areaCria);
      processarCampo('areaMel', resultado.areaMel, conf.areaMel);
      processarCampo('areaPolen', resultado.areaPolen, conf.areaPolen);
      processarCampo('condicaoCaixa', resultado.condicaoCaixa, conf.condicaoCaixa);
      processarCampo('precisaManutencao', resultado.precisaManutencao, conf.precisaManutencao);

      // Arrays (sanidade) — tratamento especial:
      // Alta confiança: aplica diretamente
      // Média confiança: passa como sugestão para o SanidadeTab
      processarCampo('invasores', resultado.invasores, conf.invasores);
      processarCampo('sinaisEnfraquecimento', resultado.sinaisEnfraquecimento, conf.sinaisEnfraquecimento);
      processarCampo('alteracoesInternas', resultado.alteracoesInternas, conf.alteracoesInternas);

      // Observações da IA: sempre aplica se existir
      if (resultado.observacoesIA) {
        setFieldValue('observacoesIA', resultado.observacoesIA);
        aplicados.push('observacoesIA');
      }

      return { aplicados, sugeridos, ignorados };
    },
    [setFieldValue]
  );

  return { aplicarResultadoIA };
}
