import PDFDocument from 'pdfkit';

export interface FormalNoticePdfInput {
  reference: string;
  issuedAt: Date;
  agencyName: string;
  landlordName: string;
  tenantName: string;
  tenantPhone: string;
  propertyAddress: string;
  currency: string;
  /** Unpaid rent, one line per overdue schedule. */
  overdueLines: Array<{
    dueDate: Date;
    amount: string;
    balance: string;
    daysOverdue: number;
  }>;
  totalDue: string;
  /** Extra period granted by the notice, in days. */
  paymentDelayDays: number;
  formalNoticeDocumentUrl?: string;
}

/**
 * Spec 04 — mise en demeure. Formal letter produced by the manager once a
 * rent is 15 days late, listing every overdue schedule before the deadline.
 */
export function renderFormalNoticePdf(
  input: FormalNoticePdfInput,
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
      .text('Mise en demeure de payer');
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#666')
      .text(input.agencyName);

    doc.moveDown(1.5);
    doc.fontSize(11).font('Helvetica').fillColor('#000');

    drawRow(doc, 'Référence', input.reference);
    drawRow(doc, 'Date d’émission', formatDate(input.issuedAt));
    drawRow(doc, 'Destinataire', input.tenantName);
    drawRow(doc, 'Téléphone', input.tenantPhone);
    drawRow(doc, 'Bailleur', input.landlordName);
    drawRow(doc, 'Bien concerné', input.propertyAddress);

    doc.moveDown();
    doc.text(
      `Nous.constatons que le règlement du loyer n’a pas été effectué pour le bien ci-dessus. ` +
        `Vous êtes mis en demeure de régulariser la somme de ${input.totalDue} ${input.currency} ` +
        `sous un délai de ${input.paymentDelayDays} jours à compter de la réception de la présente. ` +
        `À défaut, les pénalités contractuelles et les voies de recours seront entreprises.`,
      { align: 'left' },
    );

    doc.moveDown(1.5);
    doc.fontSize(12).font('Helvetica-Bold').text('Détail des impayés');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text('Échéance', 50, doc.y, { continued: true, width: 110 });
    doc.text('Montant', 160, doc.y, { continued: true, width: 90 });
    doc.text('Solde', 250, doc.y, { continued: true, width: 90 });
    doc.text('Retard', 340, doc.y);
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#ddd').stroke();
    doc.moveDown(0.3);

    for (const line of input.overdueLines) {
      const y = doc.y;
      doc.text(formatDate(line.dueDate), 50, y, { continued: true, width: 110 });
      doc.text(`${line.amount} ${input.currency}`, 160, y, {
        continued: true,
        width: 90,
      });
      doc.text(`${line.balance} ${input.currency}`, 250, y, {
        continued: true,
        width: 90,
      });
      doc.text(`${line.daysOverdue} j`, 340, y);
      doc.moveDown(0.2);
    }

    doc.moveDown(2);
    doc
      .fontSize(10)
      .fillColor('#666')
      .text(
        `Document généré automatiquement par Paradis Immo le ${formatDate(
          input.issuedAt,
        )}.`,
      );

    doc.end();
  });
}

function drawRow(doc: PDFKit.PDFDocument, label: string, value: string): void {
  doc.fontSize(11).font('Helvetica-Bold').text(`${label} : `, { continued: true });
  doc.font('Helvetica').fillColor('#000').text(value || '—');
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}
