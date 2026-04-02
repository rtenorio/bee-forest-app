export function exportCsv(filename: string, headers: string[], rows: string[][]) {
  const bom = '\uFEFF'; // UTF-8 BOM for Excel compatibility
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const content = [headers, ...rows].map((row) => row.map(esc).join(',')).join('\r\n');
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
