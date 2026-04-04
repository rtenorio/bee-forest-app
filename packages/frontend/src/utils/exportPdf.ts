import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ── Logo helper ───────────────────────────────────────────────────────────────

let _logoDataUrl: string | null = null;

async function getLogoDataUrl(): Promise<string | null> {
  if (_logoDataUrl) return _logoDataUrl;
  try {
    const res = await fetch('/logo-bee-forest.jpg');
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => { _logoDataUrl = reader.result as string; resolve(_logoDataUrl); };
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ── Header builder ────────────────────────────────────────────────────────────

async function addHeader(doc: jsPDF, title: string, subtitle?: string): Promise<number> {
  const pageW = doc.internal.pageSize.getWidth();
  let y = 14;

  const logo = await getLogoDataUrl();
  if (logo) {
    // Logo fits ~55mm wide, ~33mm tall (landscape ratio 1284:758 ≈ 1.69:1)
    const logoW = 55;
    const logoH = logoW / 1.69;
    doc.addImage(logo, 'JPEG', 14, y, logoW, logoH);
    y += logoH + 4;
  } else {
    doc.setFontSize(16);
    doc.setTextColor(180, 83, 9);
    doc.text('🐝 Bee Forest', 14, y + 6);
    y += 14;
  }

  // Divider
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.5);
  doc.line(14, y, pageW - 14, y);
  y += 6;

  // Title
  doc.setFontSize(14);
  doc.setTextColor(28, 25, 23);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, y);
  y += 6;

  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(subtitle, 14, y);
    y += 5;
  }

  // Date stamp
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, pageW - 14, y - 5, { align: 'right' });

  y += 4;
  return y;
}

// ── Hive report ───────────────────────────────────────────────────────────────

export async function exportHivePdf(params: {
  hiveCode: string;
  apiaryName: string;
  hiveData: { label: string; value: string }[];
  inspections: { date: string; inspector: string; health: string; notes: string }[];
  productions: { date: string; product: string; quantity: string; notes: string }[];
}): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = await addHeader(doc, `Relatório da Caixa ${params.hiveCode}`, params.apiaryName);

  // Hive data table
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(28, 25, 23);
  doc.text('Dados da Caixa', 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [],
    body: params.hiveData.map((d) => [d.label, d.value]),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50, fillColor: [250, 245, 235] } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Inspections
  if (params.inspections.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(28, 25, 23);
    doc.text('Histórico de Inspeções', 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Data', 'Inspetor', 'Saúde', 'Observações']],
      body: params.inspections.map((i) => [i.date, i.inspector, i.health, i.notes]),
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [245, 158, 11], textColor: [28, 25, 23], fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
    });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // Productions
  if (params.productions.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(28, 25, 23);
    doc.text('Histórico de Produções', 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Data', 'Produto', 'Quantidade', 'Observações']],
      body: params.productions.map((p) => [p.date, p.product, p.quantity, p.notes]),
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [245, 158, 11], textColor: [28, 25, 23], fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
    });
  }

  doc.save(`caixa-${params.hiveCode}-relatorio.pdf`);
}

// ── Batch report ──────────────────────────────────────────────────────────────

export async function exportBatchPdf(params: {
  batchCode: string;
  apiaryName: string;
  batchData: { label: string; value: string }[];
  movements: { date: string; action: string; details: string; responsible: string }[];
}): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = await addHeader(doc, `Relatório do Lote ${params.batchCode}`, params.apiaryName);

  // Batch data
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(28, 25, 23);
  doc.text('Dados do Lote', 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [],
    body: params.batchData.map((d) => [d.label, d.value]),
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60, fillColor: [250, 245, 235] } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Audit/movements
  if (params.movements.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(28, 25, 23);
    doc.text('Histórico de Movimentações', 14, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Data', 'Ação', 'Detalhes', 'Responsável']],
      body: params.movements.map((m) => [m.date, m.action, m.details, m.responsible]),
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [245, 158, 11], textColor: [28, 25, 23], fontStyle: 'bold' },
      margin: { left: 14, right: 14 },
    });
  }

  doc.save(`lote-${params.batchCode}-relatorio.pdf`);
}
