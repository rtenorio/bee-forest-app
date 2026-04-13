// packages/frontend/src/types/inspection.ts
// Tipos de IA para inspeção — espelha InspectionAIResult do backend

export interface InspectionAIResult {
  atividadeEntrada: 'alta' | 'media' | 'baixa' | 'ausente' | null;
  densidadePopulacional: 'alta' | 'media' | 'baixa' | null;
  areaTotal: number | null;
  areaCria: number | null;
  areaMel: number | null;
  areaPolen: number | null;
  invasores: string[];
  sinaisEnfraquecimento: string[];
  alteracoesInternas: string[];
  condicaoCaixa: 'boa' | 'regular' | 'ruim' | null;
  precisaManutencao: boolean | null;
  confidence: Record<string, number>;
  observacoesIA: string;
  alertas: string[];
}
