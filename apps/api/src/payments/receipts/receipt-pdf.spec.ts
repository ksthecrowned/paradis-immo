import { renderReceiptPdf } from './receipt-pdf';

describe('renderReceiptPdf', () => {
  it('produces a non-empty PDF buffer with %PDF magic header', async () => {
    const buffer = await renderReceiptPdf({
      number: 'REC-TEST-123',
      issuedAt: new Date('2026-06-29T12:00:00Z'),
      tenantName: 'Jean KOUKA',
      amount: '150000',
      currency: 'XAF',
      method: 'CASH',
      propertyTitle: 'Appartement 3 pièces – Bacongo',
      paymentReference: 'cash-ref-abc12345',
    });

    expect(buffer.length).toBeGreaterThan(200);
    // Every PDF starts with the literal `%PDF-`.
    expect(buffer.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
