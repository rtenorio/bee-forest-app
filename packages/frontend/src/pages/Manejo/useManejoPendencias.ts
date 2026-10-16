import { useMemo } from 'react';
import { useHives } from '@/hooks/useHives';
import { useApiaries } from '@/hooks/useApiaries';
import { useInspections } from '@/hooks/useInspections';
import { useAuthStore } from '@/store/authStore';
import { daysSince } from '@/utils/dates';
import { getManejoTask, type ManejoPendencia } from './manejoTasks';
import type { Inspection } from '@bee-forest/shared';

export interface ManejoGrupo {
  taskKey: string;
  pendencias: ManejoPendencia[];
  /** Maior daysSince do grupo — a espera mais antiga. */
  oldestDays: number;
}

export interface UseManejoPendenciasResult {
  grupos: ManejoGrupo[];
  /** Todas as pendências, já achatadas. */
  pendencias: ManejoPendencia[];
  isLoading: boolean;
  /** Colônias no escopo do usuário, com ao menos uma inspeção considerada. */
  colonyCount: number;
}

type InspecaoMinima = Pick<Inspection, 'inspected_at' | 'checklist'>;

/** Entrada mínima que o núcleo puro precisa — facilita exercitar a regra. */
interface DerivarInput {
  hives: Array<{ local_id: string; code: string; apiary_local_id: string }>;
  /** Inspeções de cada colônia, da mais nova para a mais antiga. */
  historyByHive: Map<string, InspecaoMinima[]>;
  apiaryNames: Map<string, string>;
}

function pendentesDe(insp: InspecaoMinima): unknown {
  return ((insp.checklist ?? {}) as unknown as Record<string, unknown>).management_actions_pending;
}

/**
 * Desde quando a pendência está em aberto: a inspeção mais antiga da sequência
 * ininterrupta, a partir da última, que lista a chave. Sem isso, registrar
 * outro manejo na caixa (que repete as pendências restantes) zeraria a idade
 * delas — e o "mais antiga" e o alerta de atraso passariam a mentir.
 */
function abertaDesde(historico: InspecaoMinima[], key: string): string {
  let desde = historico[0].inspected_at;
  for (const insp of historico) {
    const raw = pendentesDe(insp);
    if (!Array.isArray(raw) || !raw.includes(key)) break;
    desde = insp.inspected_at;
  }
  return desde;
}

/**
 * Núcleo puro: dada a última inspeção de cada colônia, emite uma pendência por
 * manejo listado e agrupa por manejo. Sem React, para poder ser conferido
 * isoladamente.
 */
export function derivarPendencias({ hives, historyByHive, apiaryNames }: DerivarInput): {
  grupos: ManejoGrupo[];
  pendencias: ManejoPendencia[];
  colonyCount: number;
} {
  const pendencias: ManejoPendencia[] = [];
  let colonyCount = 0;

  for (const hive of hives) {
    const historico = historyByHive.get(hive.local_id);
    if (!historico || historico.length === 0) continue; // colônia sem inspeção: fora, sem quebrar
    const insp = historico[0];

    // Leitura defensiva: inspeções antigas não têm os campos novos, e o
    // checklist gravado pode vir de qualquer versão do formulário.
    const checklist = (insp.checklist ?? {}) as unknown as Record<string, unknown>;
    const raw = checklist.management_actions_pending;
    // Formato antigo (campo ausente) fica de fora — não adivinhamos pendência
    // a partir do campo legado.
    if (!Array.isArray(raw) || raw.length === 0) continue;

    colonyCount += 1;
    // Só a observação do pendente: management_description descreve o que
    // foi feito na visita e confundiria quem vai executar a tarefa.
    const note = typeof checklist.management_pending_notes === 'string'
      ? checklist.management_pending_notes
      : '';

    for (const key of raw) {
      if (typeof key !== 'string') continue;
      if (!getManejoTask(key)) continue; // fora do catálogo: ignora em silêncio

      const desde = abertaDesde(historico, key);
      pendencias.push({
        taskKey: key,
        colonyId: hive.local_id,
        colonyCode: hive.code,
        apiaryId: hive.apiary_local_id,
        apiaryName: apiaryNames.get(hive.apiary_local_id) ?? '—',
        inspectionDate: desde,
        daysSince: daysSince(desde) ?? 0,
        note,
      });
    }
  }

  const byTask = new Map<string, ManejoPendencia[]>();
  for (const p of pendencias) {
    const list = byTask.get(p.taskKey);
    if (list) list.push(p);
    else byTask.set(p.taskKey, [p]);
  }

  const grupos: ManejoGrupo[] = [...byTask.entries()]
    .map(([taskKey, list]) => ({
      taskKey,
      pendencias: list,
      oldestDays: list.reduce((max, p) => Math.max(max, p.daysSince), 0),
    }))
    // Ordem decrescente por contagem; empate resolvido pela espera mais antiga.
    .sort((a, b) => b.pendencias.length - a.pendencias.length || b.oldestDays - a.oldestDays);

  return { grupos, pendencias, colonyCount };
}

/**
 * Agrupa as inspeções por colônia, da mais nova para a mais antiga
 * (desempate por created_at quando inspected_at é igual).
 */
export function historicoPorColonia(inspections: Inspection[]): Map<string, Inspection[]> {
  const byHive = new Map<string, Inspection[]>();
  for (const insp of inspections) {
    if (insp.deleted_at) continue;
    const list = byHive.get(insp.hive_local_id);
    if (list) list.push(insp);
    else byHive.set(insp.hive_local_id, [insp]);
  }
  for (const list of byHive.values()) {
    list.sort((a, b) =>
      b.inspected_at.localeCompare(a.inspected_at)
      || (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  }
  return byHive;
}

/** A inspeção mais nova de cada colônia. */
export function selecionarUltimaPorColonia(inspections: Inspection[]): Map<string, Inspection> {
  const latest = new Map<string, Inspection>();
  for (const [hiveId, list] of historicoPorColonia(inspections)) latest.set(hiveId, list[0]);
  return latest;
}

/**
 * Lê o manejo PENDENTE da última inspeção de cada colônia ativa no escopo do
 * usuário e agrupa por manejo.
 *
 * A pendência é estado derivado: não existe tabela nem campo de conclusão. Uma
 * inspeção mais nova que não liste a chave faz a pendência desaparecer sozinha.
 *
 * Casos tratados de propósito:
 * - Colônia sem nenhuma inspeção fica de fora, sem quebrar.
 * - Última inspeção no formato antigo (sem management_actions_pending) fica de
 *   fora. NÃO inferimos pendência do campo legado management_actions: lá não há
 *   como distinguir "alimentei" de "precisa alimentar", que é justamente o
 *   problema que a separação resolve.
 * - Chave presente na inspeção mas ausente do catálogo é ignorada em silêncio.
 */
export function useManejoPendencias(apiaryId?: string): UseManejoPendenciasResult {
  const user = useAuthStore((s) => s.user);
  const { data: hives = [], isLoading: loadingHives } = useHives();
  const { data: apiaries = [], isLoading: loadingApiaries } = useApiaries();
  const { data: inspections = [], isLoading: loadingInspections } = useInspections();

  const isLoading = loadingHives || loadingApiaries || loadingInspections;

  // Mesmo escopo das telas existentes: só o tratador é restrito à lista
  // explícita de caixas (ver BatchInspectionPage).
  const accessibleHives = useMemo(() => {
    if (!user) return [];
    const active = user.role === 'tratador'
      ? hives.filter((h) => user.hive_local_ids.includes(h.local_id) && h.status === 'active' && !h.deleted_at)
      : hives.filter((h) => h.status === 'active' && !h.deleted_at);
    return apiaryId ? active.filter((h) => h.apiary_local_id === apiaryId) : active;
  }, [hives, user, apiaryId]);

  const historyByHive = useMemo(
    () => historicoPorColonia(inspections),
    [inspections]
  );

  const apiaryNames = useMemo(
    () => new Map(apiaries.map((a) => [a.local_id, a.name])),
    [apiaries]
  );

  return useMemo(() => {
    const { grupos, pendencias, colonyCount } = derivarPendencias({
      hives: accessibleHives,
      historyByHive,
      apiaryNames,
    });
    return { grupos, pendencias, isLoading, colonyCount };
  }, [accessibleHives, historyByHive, apiaryNames, isLoading]);
}
