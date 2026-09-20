/**
 * Catálogo único de manejos.
 *
 * As chaves vêm do catálogo que os formulários de inspeção sempre usaram
 * (ColonyInspectionPage e BatchInspectionPage, que agora derivam os chips daqui)
 * — não inventar strings novas, senão o Painel de Manejo deixa de casar com o
 * que o formulário grava.
 *
 * `sem_intervencao` fica de fora de propósito: é sentinela de "nada a fazer",
 * não um manejo. Continua selecionável nos dois blocos do formulário,
 * mas não gera pendência — cai na regra de chave ausente do catálogo, que o
 * hook ignora em silêncio.
 *
 * Qualquer manejo pode aparecer nos dois blocos (feito e pendente) ao mesmo
 * tempo: dividi hoje e ainda preciso dividir de novo é caso real. Por isso não
 * existe flag do tipo `isPendencia`.
 */

export interface ManejoTask {
  key: string;
  /** Rótulo no passado, para o bloco de manejo realizado. */
  labelFeito: string;
  /** Rótulo no infinitivo, para o bloco de manejo pendente e para o painel. */
  labelPendente: string;
  icon: string;
  /** Classe Tailwind de cor do ícone/acento, no tema escuro do app. */
  colorClass: string;
}

export const MANEJO_TASKS: ManejoTask[] = [
  {
    key: 'alimentacao',
    labelFeito: 'Alimentei',
    labelPendente: 'Alimentar',
    icon: '🌺',
    colorClass: 'text-orange-400',
  },
  {
    key: 'limpeza_externa',
    labelFeito: 'Limpei por fora',
    labelPendente: 'Limpar por fora',
    icon: '🧽',
    colorClass: 'text-sky-400',
  },
  {
    key: 'controle_formigas',
    labelFeito: 'Controlei formigas',
    labelPendente: 'Controlar formigas',
    icon: '🐜',
    colorClass: 'text-red-400',
  },
  {
    key: 'reducao_entrada',
    labelFeito: 'Reduzi a entrada',
    labelPendente: 'Reduzir a entrada',
    icon: '🚪',
    colorClass: 'text-amber-400',
  },
  {
    key: 'troca_caixa',
    labelFeito: 'Troquei a caixa',
    labelPendente: 'Trocar a caixa',
    icon: '📦',
    colorClass: 'text-yellow-400',
  },
  {
    key: 'ajuste_vedacao',
    labelFeito: 'Ajustei a vedação',
    labelPendente: 'Ajustar a vedação',
    icon: '🔧',
    colorClass: 'text-stone-300',
  },
  {
    key: 'reorganizacao_interna',
    labelFeito: 'Reorganizei por dentro',
    labelPendente: 'Reorganizar por dentro',
    icon: '🗂️',
    colorClass: 'text-indigo-400',
  },
  {
    key: 'divisao',
    labelFeito: 'Dividi',
    labelPendente: 'Dividir',
    icon: '✂️',
    colorClass: 'text-emerald-400',
  },
  {
    key: 'isolamento_colonia',
    labelFeito: 'Isolei a colônia',
    labelPendente: 'Isolar a colônia',
    icon: '🚧',
    colorClass: 'text-rose-400',
  },
  {
    key: 'uniao_colonia',
    labelFeito: 'Uni com outra colônia',
    labelPendente: 'Unir com outra colônia',
    icon: '🤝',
    colorClass: 'text-teal-400',
  },
  {
    key: 'encaminhada_avaliacao',
    labelFeito: 'Encaminhei para avaliação técnica',
    labelPendente: 'Encaminhar para avaliação técnica',
    icon: '🔬',
    colorClass: 'text-purple-400',
  },
];

export type ManejoTaskKey = (typeof MANEJO_TASKS)[number]['key'];

const BY_KEY = new Map(MANEJO_TASKS.map((t) => [t.key, t]));

/** Devolve o manejo do catálogo, ou null se a chave não for conhecida. */
export function getManejoTask(key: string): ManejoTask | null {
  return BY_KEY.get(key) ?? null;
}

/**
 * Chave sentinela de "nada a fazer". Fica no formulário mas nunca no painel.
 */
export const SEM_INTERVENCAO = 'sem_intervencao';

/** Uma pendência é sempre derivada da última inspeção da colônia. */
export interface ManejoPendencia {
  taskKey: ManejoTaskKey;
  colonyId: string;
  colonyCode: string;
  apiaryId: string;
  apiaryName: string;
  /** inspected_at da inspeção que originou a pendência. */
  inspectionDate: string;
  /** Dias corridos desde essa inspeção. */
  daysSince: number;
  /** Observação do manejo registrada na inspeção, se houver. */
  note: string;
}
