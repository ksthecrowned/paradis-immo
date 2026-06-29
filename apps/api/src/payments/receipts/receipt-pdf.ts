import PDFDocument from 'pdfkit';

export interface ReceiptPdfInput {
  number: string;
  issuedAt: Date;
  tenantName: string;
  amount: string;
  currency: string;
  method: string;
  propertyTitle: string;
  paymentReference: string;
}

/**
 * Render a one-page A4 PDF receipt with header, payment info, and footer.
 * Returns the raw PDF bytes — caller is responsible for persistence/upload.
 */
export function renderReceiptPdf(input: ReceiptPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    // Header
    doc
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('Paradis Immo', { align: 'left' });
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#666')
      .text('Reçu de paiement', { align: 'left' });
    doc.moveDown(1.5);
    doc.fillColor('#000');

    // Receipt metadata (top-right block)
    const metaY = doc.y;
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('Numéro', metaY, metaY, { continued: true })
      .font('Helvetica')
      .text(`: ${input.number}`);
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .text('Date', { continued: true })
      .font('Helvetica')
      .text(`: ${formatDate(input.issuedAt)}`);
    doc.moveDown(2);

    // Body — payment info
    doc.fontSize(12).font('Helvetica-Bold').text('Détails du paiement');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');

    drawRow(doc, 'Locataire', input.tenantName);
    drawRow(doc, 'Bien', input.propertyTitle);
    drawRow(doc, 'Méthode', input.method);
    drawRow(doc, 'Référence', input.paymentReference);
    drawRow(doc, 'Montant', `${input.amount} ${input.currency}`);

    doc.moveDown(2);

    // Footer
    doc
      .fontSize(9)
      .fillColor('#888')
      .text(
        'Ce reçu est généré automatiquement. Pour toute question, contactez contact@paradis-immo.example.',
        { align: 'center' },
      );

    doc.end();
  });
}

function drawRow(doc: PDFKit.PDFDocument, label: string, value: string): void {
  doc.font('Helvetica-Bold').text(label, { continued: true });
  doc.font('Helvetica').text(`: ${value}`);
}

function formatDate(date: Date): string {
  const d = date.toISOString().slice(0, 10);
  return d;
}
