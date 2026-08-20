import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

export interface InvoicePdfData {
  number: string;
  receipt: string;
  campus: string;
  registration: string;
  student: string;
  description: string;
  amount: number;
  currency: string;
  method: string;
  issuedAt: Date;
  verificationUrl: string;
}

@Injectable()
export class InvoicePdfService {
  async render(data: InvoicePdfData): Promise<Buffer> {
    const qr = await QRCode.toDataURL(data.verificationUrl, {
      width: 220,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
    const document = new PDFDocument({
      size: 'LETTER',
      margin: 48,
      info: { Title: `Factura ${data.number}`, Author: 'SIGMA - UCOTESIS' },
    });
    const chunks: Buffer[] = [];
    document.on('data', (chunk: Buffer) => chunks.push(chunk));
    const completed = new Promise<Buffer>((resolve, reject) => {
      document.on('end', () => resolve(Buffer.concat(chunks)));
      document.on('error', reject);
    });
    document
      .fillColor('#0b4c7c')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text('SIGMA · UCOTESIS');
    document
      .fillColor('#0f172a')
      .fontSize(10)
      .font('Helvetica')
      .text('Universidad Autónoma de Santo Domingo', { continued: false });
    document
      .moveDown(1.2)
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(`Factura ${data.number}`);
    document
      .moveDown(0.2)
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#475569')
      .text(
        `Recibo: ${data.receipt}  ·  Emisión: ${formatDate(data.issuedAt)}`,
      );
    document.moveDown(1.5);
    const rows: Array<[string, string]> = [
      ['Recinto', data.campus],
      ['Matrícula', data.registration],
      ['Estudiante', data.student],
      ['Descripción', data.description],
      ['Método de pago', data.method],
    ];
    rows.forEach(([label, value]) => {
      document
        .fillColor('#64748b')
        .font('Helvetica-Bold')
        .text(label, 48, document.y, { width: 125, continued: true });
      document.fillColor('#0f172a').font('Helvetica').text(value);
      document.moveDown(0.45);
    });
    document.moveDown().roundedRect(48, document.y, 310, 58, 8).fill('#eff6ff');
    const amountY = document.y - 43;
    document
      .fillColor('#1d4ed8')
      .font('Helvetica-Bold')
      .fontSize(11)
      .text('TOTAL PAGADO', 64, amountY);
    document.fontSize(20).text(
      new Intl.NumberFormat('es-DO', {
        style: 'currency',
        currency: data.currency,
      }).format(data.amount),
      64,
      amountY + 18,
    );
    document.image(qr, 390, 190, { width: 150 });
    document
      .fillColor('#475569')
      .font('Helvetica')
      .fontSize(8)
      .text('Escanea para validar este comprobante en SIGMA.', 390, 345, {
        width: 150,
        align: 'center',
      });
    document
      .moveDown(5)
      .fillColor('#64748b')
      .fontSize(9)
      .text(
        'Documento electrónico oficial. Su autenticidad se comprueba mediante el código QR.',
        48,
        500,
        { width: 500, align: 'center' },
      );
    document.end();
    return completed;
  }
}
function formatDate(value: Date) {
  return new Intl.DateTimeFormat('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Santo_Domingo',
  }).format(value);
}
