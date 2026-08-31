import { InvoicePdfService } from './invoice-pdf.service';

describe('InvoicePdfService', () => {
  it('genera una factura PDF completa con datos extensos', async () => {
    const pdf = await new InvoicePdfService().render({
      number: 'SIGMA-2026-00000001',
      receipt: 'REC-2026-00000001',
      campus: 'Universidad Autónoma de Santo Domingo - Recinto Santiago',
      registration: '100576672',
      student: 'PABLO PIDDY',
      description:
        'Monográfico Santiago 2026 - Inscripción de tesis o curso equivalente',
      amount: 10000,
      currency: 'DOP',
      method: 'Transferencia bancaria',
      issuedAt: new Date('2026-08-31T14:52:00.000Z'),
      verificationUrl:
        'http://localhost:3000/api/invoices/verify/token-de-prueba',
    });

    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(5000);
  });
});
