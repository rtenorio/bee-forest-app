import type { Hive, Inspection, Production, Feeding } from '@bee-forest/shared';
import { normalizeChecklistHealth } from './inspectionUtils';

function toCSV(headers: string[], rows: string[][]): string {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return [headers.map(escape), ...rows.map((r) => r.map(escape))].map((r) => r.join(',')).join('\n');
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportHivesCSV(hives: Hive[]) {
  const headers = ['Código', 'Status', 'Tipo de Caixa', 'Data Instalação', 'Notas'];
  const rows = hives.map((h) => [h.code, h.status, h.box_type, h.installation_date ?? '', h.notes]);
  downloadFile(toCSV(headers, rows), 'caixas de abelha.csv', 'text/csv;charset=utf-8;');
}

export function exportInspectionsCSV(inspections: Inspection[]) {
  const headers = ['Data', 'Inspetor', 'Força Pop.', 'Mel', 'Precisa Alimentação', 'Notas'];
  const rows = inspections.map((i) => {
    const health = normalizeChecklistHealth(i.checklist);
    const raw = i.checklist as unknown as Record<string, unknown>;
    return [
      i.inspected_at.slice(0, 10),
      i.inspector_name,
      String(health.strength),
      (raw.honey_stores as string) ?? '',
      health.needsFeeding ? 'Sim' : 'Não',
      i.notes,
    ];
  });
  downloadFile(toCSV(headers, rows), 'inspecoes.csv', 'text/csv;charset=utf-8;');
}

export function exportProductionsCSV(productions: Production[]) {
  const headers = ['Data', 'Produto', 'Quantidade (g)', 'Grau', 'Notas'];
  const rows = productions.map((p) => [
    p.harvested_at,
    p.product_type,
    String(p.quantity_g),
    p.quality_grade ?? '',
    p.notes,
  ]);
  downloadFile(toCSV(headers, rows), 'producoes.csv', 'text/csv;charset=utf-8;');
}

export function exportFeedingsCSV(feedings: Feeding[]) {
  const headers = ['Data', 'Tipo', 'Quantidade (ml)', 'Notas'];
  const rows = feedings.map((f) => [f.fed_at, f.feed_type, String(f.quantity_ml ?? ''), f.notes]);
  downloadFile(toCSV(headers, rows), 'alimentacoes.csv', 'text/csv;charset=utf-8;');
}
