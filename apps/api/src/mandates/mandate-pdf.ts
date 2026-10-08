import PDFDocument from 'pdfkit';

export interface MandatePdfInput {
  propertyTitle: string;
  scopes: string[];
  managementFeeRate: string | null;
  startDate: Date;
  endDate: Date | null;
  ownerSignedAt: Date | null;
  agencySignedAt: Date | null;
}

/**
 * Render the mandate document countersigned by both parties (spec 03 US 3).
 * Returns raw PDF bytes; the caller uploads it and stores the key as
 * `Mandate.signedDocumentKey`.
 */
export function renderMandatePdf(input: MandatePdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));

    const fmt = (d: Date | null) =>
      d ? d.toLocaleDateString('fr-FR') : '—';

    doc.fontSize(20).font('Helvetica-Bold').text('Paradis Immo');
    doc.moveDown(0.2);
    doc.fontSize(15).font('Helvetica-Bold').text('Mandat de gestion');
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica');
    doc.text(`Bien : ${input.propertyTitle}`);
    doc.text(`Périmètres : ${input.scopes.join(', ') || '—'}`);
    doc.text(
      `Honoraires de gestion : ${
        input.managementFeeRate
          ? `${Number(input.managementFeeRate) * 100} %`
          : '—'
      }`,
    );
    doc.text(`Début : ${fmt(input.startDate)}`);
    doc.text(`Fin : ${fmt(input.endDate)}`);
    doc.moveDown(1);

    doc.fontSize(12).font('Helvetica-Bold').text('Signatures électroniques');
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica');
    doc.text(`Propriétaire : ${fmt(input.ownerSignedAt)}`);
    doc.text(`Agence : ${fmt(input.agencySignedAt)}`);
    doc.moveDown(1.5);
    doc
      .fontSize(9)
      .fillColor('#666666')
      .text(
        'Document signé électroniquement par les deux parties via code de vérification par SMS.',
      );

    doc.end();
  });
}
