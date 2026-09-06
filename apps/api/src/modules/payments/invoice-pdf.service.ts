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
    const pageWidth = document.page.width;
    const contentWidth = pageWidth - 96;
    const blue = '#0b4c7c';
    const navy = '#0f172a';
    const muted = '#64748b';

    document.rect(0, 0, pageWidth, 112).fill(blue);
    document
      .fillColor('#ffffff')
      .font('Helvetica-Bold')
      .fontSize(24)
      .text('SIGMA', 48, 35);
    document
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#dbeafe')
      .text('UCOTESIS - Universidad Autónoma de Santo Domingo', 48, 67);
    document
      .roundedRect(438, 36, 126, 34, 17)
      .fill('#ffffff')
      .fillColor(blue)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('PAGO APROBADO', 438, 48, { width: 126, align: 'center' });

    document
      .fillColor(navy)
      .font('Helvetica-Bold')
      .fontSize(data.number.length > 24 ? 17 : 21)
      .text(`Factura ${data.number}`, 48, 142, {
        width: contentWidth,
        height: 28,
        ellipsis: true,
      });
    document
      .font('Helvetica')
      .fontSize(9.5)
      .fillColor(muted)
      .text(
        `Recibo ${data.receipt} - Emitida ${formatDate(data.issuedAt)}`,
        48,
        174,
        {
          width: contentWidth,
          height: 15,
          ellipsis: true,
        },
      );

    const detailsX = 48;
    const detailsY = 211;
    const detailsWidth = 330;
    const detailsHeight = 218;
    document
      .roundedRect(detailsX, detailsY, detailsWidth, detailsHeight, 12)
      .fill('#f8fafc');
    document
      .fillColor(navy)
      .font('Helvetica-Bold')
      .fontSize(11)
      .text('Información de la inscripción', detailsX + 18, detailsY + 17);
    document
      .moveTo(detailsX + 18, detailsY + 39)
      .lineTo(detailsX + detailsWidth - 18, detailsY + 39)
      .lineWidth(0.7)
      .strokeColor('#dbe3ee')
      .stroke();

    drawField(
      document,
      'Estudiante',
      data.student,
      detailsX + 18,
      detailsY + 54,
      294,
    );
    drawField(
      document,
      'Matrícula',
      data.registration,
      detailsX + 18,
      detailsY + 98,
      135,
    );
    drawField(
      document,
      'Recinto',
      data.campus,
      detailsX + 171,
      detailsY + 98,
      141,
    );
    drawField(
      document,
      'Concepto',
      data.description,
      detailsX + 18,
      detailsY + 146,
      294,
    );
    drawField(
      document,
      'Método de pago',
      data.method,
      detailsX + 18,
      detailsY + 187,
      294,
    );

    const verificationX = 396;
    document
      .roundedRect(verificationX, detailsY, 168, detailsHeight, 12)
      .fill('#f8fafc');
    document
      .fillColor(navy)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text('Verificación digital', verificationX + 14, detailsY + 17, {
        width: 140,
        align: 'center',
      });
    document.image(qr, verificationX + 24, detailsY + 45, { width: 120 });
    document
      .fillColor(muted)
      .font('Helvetica')
      .fontSize(7.5)
      .text(
        'Escanea el código para comprobar la autenticidad de esta factura.',
        verificationX + 16,
        detailsY + 172,
        {
          width: 136,
          align: 'center',
          lineGap: 2,
        },
      );

    const totalY = 451;
    document.roundedRect(48, totalY, contentWidth, 86, 12).fill('#eff6ff');
    document
      .fillColor('#1e40af')
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('TOTAL PAGADO', 68, totalY + 21, { characterSpacing: 0.8 });
    document
      .fillColor('#1d4ed8')
      .font('Helvetica-Bold')
      .fontSize(22)
      .text(formatMoney(data.amount, data.currency), 68, totalY + 42, {
        width: contentWidth - 40,
        height: 28,
        ellipsis: true,
      });

    document
      .fillColor(muted)
      .font('Helvetica')
      .fontSize(8.5)
      .text(
        'Este documento electrónico fue generado por SIGMA. La validación mediante el código QR confirma que el pago y la inscripción están registrados en UCOTESIS.',
        80,
        575,
        { width: pageWidth - 160, align: 'center', lineGap: 3 },
      );
    document
      .moveTo(48, 706)
      .lineTo(pageWidth - 48, 706)
      .lineWidth(0.7)
      .strokeColor('#dbe3ee')
      .stroke();
    document
      .fillColor(muted)
      .fontSize(8)
      .text(
        'SIGMA - Sistema de Gestión e Inscripción Virtual de Tesis y Monográficos',
        48,
        720,
        {
          width: contentWidth,
          align: 'center',
        },
      );
    document.end();
    return completed;
  }
}

function drawField(
  document: PDFKit.PDFDocument,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
) {
  document
    .fillColor('#64748b')
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .text(label.toUpperCase(), x, y, { width, characterSpacing: 0.4 });
  document
    .fillColor('#0f172a')
    .font('Helvetica')
    .fontSize(9.5)
    .text(value, x, y + 12, { width, height: 27, ellipsis: true, lineGap: 1 });
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}
function formatDate(value: Date) {
  return new Intl.DateTimeFormat('es-DO', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'America/Santo_Domingo',
  }).format(value);
}
