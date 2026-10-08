import PDFDocument from 'pdfkit';

export interface RentReceiptPdfInput {
  number: string;
  issuedAt: Date;
  periodStart: Date;
  periodEnd: Date;
  /** Rent only. */
  rentAmount: string;
  /** Charges included in the period. */
  chargesAmount: string;
  totalAmount: string;
  currency: string;
  tenantName: string;
  landlordName: string;
  agencyName: string;
  propertyAddress: string;
}

/**
 * Spec 04 — quittance de loyer mensuelle. Shows the period, the rent/charges
 * split and the landlord / agency / tenant parties.
 */
export function renderRentReceiptPdf(
  input: RentReceiptPdfInput,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    doc.fontSize(22).font('Helvetica-Bold').text('Paradis Immo');
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#111')
      .text('Quittance de loyer');
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#666')
      .text(input.agencyName);

    doc.moveDown(1.5);
    doc.fillColor('#000').fontSize(11);

    drawRow(doc, 'Numéro', input.number);
    drawRow(doc, 'Date d’émission', formatDate(input.issuedAt));
    drawRow(
      doc,
      'Période',
      `${formatDate(input.periodStart)} → ${formatDate(input.periodEnd)}`,
    );

    doc.moveDown(1.5);
    doc.fontSize(12).font('Helvetica-Bold').text('Montants');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    drawRow(doc, 'Loyer', `${input.rentAmount} ${input.currency}`);
    drawRow(doc, 'Charges', `${input.chargesAmount} ${input.currency}`);
    drawRow(doc, 'Total', `${input.totalAmount} ${input.currency}`);

    doc.moveDown(1.5);
    doc.fontSize(12).font('Helvetica-Bold').text('Parties');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    drawRow(doc, 'Bailleur', input.landlordName);
    drawRow(doc, 'Agence', input.agencyName);
    drawRow(doc, 'Locataire', input.tenantName);
    drawRow(doc, 'Adresse du bien', input.propertyAddress);

    doc.moveDown(2);
    doc
      .fontSize(9)
      .fillColor('#666')
      .text(
        'La presente quittance atteste du bon paiement du loyer et des charges ci-dessus.',
        { align: 'left' },
      );

    doc.end();
  });
}

function drawRow(doc: PDFKit.PDFDocument, label: string, value: string): void {
  doc.font('Helvetica-Bold').text(`${label} : `, { continued: true });
  doc.font('Helvetica').text(value);
}

function formatDate(d: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}