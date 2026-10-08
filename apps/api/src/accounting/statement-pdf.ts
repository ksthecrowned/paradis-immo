import PDFDocument from 'pdfkit';

export interface StatementPdfInput {
  periodStart: Date;
  periodEnd: Date;
  label?: string;
  totals: Record<string, unknown>;
  entries: Array<{
    date: Date;
    type: string;
    label: string;
    amount: string;
    currency: string;
  }>;
}

/**
 * Render the monthly management statement ("relevé de gérance") for an
 * owner (spec 03 US 13). The `net` shown here is computed from the same
 * ledger rows listed below it.
 */
export function renderStatementPdf(
  input: StatementPdfInput,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    const fmt = (d: Date) => d.toLocaleDateString('fr-FR');

    doc.fontSize(20).font('Helvetica-Bold').text('Paradis Immo');
    doc.moveDown(0.2);
    doc.fontSize(15).font('Helvetica-Bold').text('Relevé de gérance');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    doc.text(
      `Période : du ${fmt(input.periodStart)} au ${fmt(input.periodEnd)}`,
    );
    if (input.label) doc.text(`Mandat : ${input.label}`);
    doc.moveDown(1);

    doc.fontSize(12).font('Helvetica-Bold').text('Totaux');
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica');
    for (const [key, value] of Object.entries(input.totals)) {
      doc.text(`${key} : ${String(value)}`);
    }
    doc.moveDown(1);

    doc.fontSize(12).font('Helvetica-Bold').text('Écritures');
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica');
    for (const entry of input.entries) {
      doc.text(
        `${fmt(entry.date)}  ${entry.type.padEnd(12)} ${entry.amount} ${entry.currency}  ${entry.label}`,
      );
    }
    doc.moveDown(1.5);
    doc
      .fontSize(9)
      .fillColor('#666666')
      .text(
        'Document généré automatiquement par Paradis Immo à partir du grand livre.',
      );

    doc.end();
  });
}
