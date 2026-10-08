import PDFDocument from 'pdfkit';

export interface AmendmentPdfInput {
  propertyTitle: string;
  previousRent: string;
  newRent: string;
  currency: string;
  effectiveFrom: Date;
  decidedAt: Date;
}

/**
 * Render the rent-reduction amendment ("avenant") generated when the owner
 * approves a RENT_REDUCTION request (spec 03 — US 10).
 * Returns raw PDF bytes; the caller uploads them to R2.
 */
export function renderAmendmentPdf(input: AmendmentPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    doc.fontSize(20).font('Helvetica-Bold').text('Paradis Immo');
    doc.moveDown(0.3);
    doc.fontSize(16).font('Helvetica-Bold').text('Avenant de bail — réduction de loyer');
    doc.moveDown(1);

    doc.fontSize(11).font('Helvetica');
    doc.text(`Bien : ${input.propertyTitle}`);
    doc.text(
      `Loyer précédent : ${input.previousRent || '—'} ${input.currency}`,
    );
    doc.text(`Nouveau loyer : ${input.newRent} ${input.currency}`);
    doc.text(
      `Applicable à compter du : ${input.effectiveFrom.toLocaleDateString('fr-FR')}`,
    );
    doc.text(
      `Approuvé le : ${input.decidedAt.toLocaleDateString('fr-FR')}`,
    );
    doc.moveDown(2);
    doc
      .fontSize(9)
      .fillColor('#666666')
      .text(
        'Document généré automatiquement par Paradis Immo suite à l’approbation du propriétaire.',
        { align: 'left' },
      );

    doc.end();
  });
}
