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

/** Entrada mínima que o núcleo puro precisa — facilita exercitar a regra. */
interface DerivarInput {
  hives: Array<{ local_id: string; code: string; apiary_local_id: string }>;
  latestByHive: Map<string, Pick<Inspection, 'inspected_at' | 'checklist'>>;
  apiaryNames: Map<string, string>;
}

/**
 * Núcleo puro: dada a última inspeção de cada colônia, emite uma pendência por
 * manejo listado e agrupa por manejo. Sem React, para poder ser conferido
 * isoladamente.
 */
export function derivarPendencias({ hives, latestByHive, apiaryNames }: DerivarInput): {
  grupos: ManejoGrupo[];
  pendencias: ManejoPendencia[];
  colonyCount: number;
} {
  const pendencias: ManejoPendencia[] = [];
  let colonyCount = 0;

  for (const hive of hives) {
    const insp = latestByHive.get(hive.local_id);
    if (!insp) continue; // colônia sem inspeção: fora, sem quebrar

    // Leitura defensiva: inspeções antigas não têm os campos novos, e o
    // checklist gravado pode vir de qualquer versão do formulário.
    const checklist = (insp.checklist ?? {}) as unknown as Record<string, unknown>;
    const raw = checklist.management_actions_pending;
    // Formato antigo (campo ausente) fica de fora — não adivinhamos pendência
    // a partir do campo legado.
    if (!Array.isArray(raw) || raw.length === 0) continue;

    colonyCount += 1;
    const note = typeof checklist.management_description === 'string'
      ? checklist.management_description
      : '';

    for (const key of raw) {
      if (typeof key !== 'string') continue;
      if (!getManejoTask(key)) continue; // fora do catálogo: ignora em silêncio

      pendencias.push({
        taskKey: key,
        colonyId: hive.local_id,
        colonyCode: hive.code,
        apiaryId: hive.apiary_local_id,
        apiaryName: apiaryNames.get(hive.apiary_local_id) ?? '—',
        inspectionDate: insp.inspected_at,
        daysSince: daysSince(insp.inspected_at) ?? 0,
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
 * Seleciona a inspeção de maior data por colônia, com desempate por created_at.
 */
export function selecionarUltimaPorColonia(inspections: Inspection[]): Map<string, Inspection> {
  const latest = new Map<string, Inspection>();
  for (const insp of inspections) {
    if (insp.deleted_at) continue;
    const current = latest.get(insp.hive_local_id);
    if (!current) {
      latest.set(insp.hive_local_id, insp);
      continue;
    }
    const byDate = insp.inspected_at.localeCompare(current.inspected_at);
    const wins = byDate > 0
      || (byDate === 0 && (insp.created_at ?? '').localeCompare(current.created_at ?? '') > 0);
    if (wins) latest.set(insp.hive_local_id, insp);
  }
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

  // Uma passada sobre todas as inspeções: a última de cada colônia.
  // Desempate por created_at quando inspected_at é igual.
  const latestByHive = useMemo(
    () => selecionarUltimaPorColonia(inspections),
    [inspections]
  );

  const apiaryNames = useMemo(
    () => new Map(apiaries.map((a) => [a.local_id, a.name])),
    [apiaries]
  );

  return useMemo(() => {
    const { grupos, pendencias, colonyCount } = derivarPendencias({
      hives: accessibleHives,
      latestByHive,
      apiaryNames,
    });
    return { grupos, pendencias, isLoading, colonyCount };
  }, [accessibleHives, latestByHive, apiaryNames, isLoading]);
}
