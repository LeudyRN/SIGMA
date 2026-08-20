import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../../prisma/prisma.service';
import {
  compareAcademicPeriods,
  selectEffectiveAcademicAttempts,
} from './academic-history-results';

const PAGE_MARGIN = 32;
const CONTENT_WIDTH = 548;
const PAGE_BOTTOM = 722;
const COLORS = {
  accent: '#145DA0',
  accentDark: '#0B365D',
  border: '#C9D4DF',
  headerFill: '#EAF2F8',
  muted: '#5D6B78',
  rowAlternate: '#F8FAFC',
  summaryFill: '#F1F6FA',
  text: '#17212B',
  white: '#FFFFFF',
};

const COLUMNS = [
  { label: 'Clave', width: 60, align: 'left' as const },
  { label: 'Asignatura', width: 250, align: 'left' as const },
  { label: 'Nota', width: 55, align: 'center' as const },
  { label: 'Resultado', width: 105, align: 'center' as const },
  { label: 'Créditos', width: 78, align: 'center' as const },
];

export type HistoryRecord = Awaited<
  ReturnType<AcademicHistoryPdfService['loadHistory']>
>['history'][number];
export type HistoryDocument = Awaited<
  ReturnType<AcademicHistoryPdfService['loadHistory']>
>;

@Injectable()
export class AcademicHistoryPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async exportCareer(
    careerId: string,
  ): Promise<{ buffer: Buffer; matricula: string }> {
    const data = await this.loadHistory(careerId);
    const buffer = await createAcademicHistoryPdf(data);
    return { buffer, matricula: data.student.matricula };
  }

  async loadHistory(careerId: string) {
    const career = await this.prisma.estudiante_carreras.findUnique({
      where: { id_estudiante_carrera: toBigInt(careerId) },
      include: {
        estudiantes: { include: { usuarios: true } },
        planes_estudio: {
          include: {
            carreras: {
              include: { escuelas: { include: { facultades: true } } },
            },
          },
        },
        recinto_carreras: { include: { recintos: true } },
        historial_academico: {
          include: { asignaturas: true },
          orderBy: [
            { periodo_codigo: 'asc' },
            { asignaturas: { codigo: 'asc' } },
          ],
        },
      },
    });

    if (!career) {
      throw new NotFoundException('Carrera estudiantil no encontrada.');
    }

    return {
      campus: career.recinto_carreras.recintos.nombre,
      career: career.planes_estudio.carreras,
      history: selectEffectiveAcademicAttempts(career.historial_academico).sort(
        (left, right) =>
          compareAcademicPeriods(left.periodo_codigo, right.periodo_codigo),
      ),
      plan: career.planes_estudio,
      student: {
        matricula: career.estudiantes.matricula,
        name: `${career.estudiantes.usuarios.nombres} ${career.estudiantes.usuarios.apellidos}`.trim(),
      },
    };
  }
}

export function createAcademicHistoryPdf(
  data: HistoryDocument,
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      bufferPages: true,
      margins: {
        top: PAGE_MARGIN,
        bottom: 44,
        left: PAGE_MARGIN,
        right: PAGE_MARGIN,
      },
    });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Uint8Array) => chunks.push(Buffer.from(chunk)));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    renderHeader(doc, data);

    if (!data.history.length) {
      doc
        .roundedRect(PAGE_MARGIN, doc.y, CONTENT_WIDTH, 54, 4)
        .fillAndStroke(COLORS.summaryFill, COLORS.border);
      doc
        .fillColor(COLORS.muted)
        .font('Helvetica')
        .fontSize(10)
        .text(
          'Este expediente todavía no contiene registros académicos.',
          PAGE_MARGIN + 12,
          doc.y - 39,
          {
            width: CONTENT_WIDTH - 24,
          },
        );
    } else {
      const grouped = groupByPeriod(data.history);
      for (const [period, records] of grouped) {
        renderPeriod(doc, data, period, records);
      }
      renderSummary(doc, data);
    }

    renderFooters(doc, data.student.matricula);
    doc.end();
  });
}

function renderHeader(doc: PDFKit.PDFDocument, data: HistoryDocument): void {
  const top = PAGE_MARGIN;
  const leftWidth = 350;
  const rightX = PAGE_MARGIN + 370;
  const rightWidth = CONTENT_WIDTH - 370;

  doc
    .fillColor(COLORS.accentDark)
    .font('Helvetica-Bold')
    .fontSize(16)
    .text('Universidad Autónoma de Santo Domingo', PAGE_MARGIN, top, {
      width: leftWidth,
    });
  doc.moveDown(0.3);
  doc
    .fontSize(11)
    .text(data.career.escuelas.facultades.nombre, { width: leftWidth });
  doc
    .fillColor(COLORS.text)
    .font('Helvetica')
    .fontSize(9.5)
    .text(data.career.escuelas.nombre, { width: leftWidth })
    .text(data.career.nombre, { width: leftWidth });
  const leftBottom = doc.y;

  doc
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(8)
    .text('HISTÓRICO ACADÉMICO', rightX, top + 2, {
      align: 'right',
      width: rightWidth,
    });
  doc
    .fillColor(COLORS.accentDark)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(data.student.matricula, rightX, doc.y + 3, {
      align: 'right',
      width: rightWidth,
    });
  doc
    .fillColor(COLORS.text)
    .font('Helvetica')
    .fontSize(8.5)
    .text(data.student.name, rightX, doc.y + 3, {
      align: 'right',
      width: rightWidth,
    });
  const dividerY = Math.max(leftBottom, doc.y) + 11;

  doc
    .moveTo(PAGE_MARGIN, dividerY)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, dividerY)
    .lineWidth(1.2)
    .strokeColor(COLORS.accent)
    .stroke();
  doc
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(8)
    .text(
      `Plan ${data.plan.codigo} - ${data.campus}`,
      PAGE_MARGIN,
      dividerY + 8,
      {
        width: CONTENT_WIDTH,
      },
    );
  doc.y = dividerY + 26;
}

function renderContinuationHeader(
  doc: PDFKit.PDFDocument,
  data: HistoryDocument,
): void {
  const y = PAGE_MARGIN;
  doc
    .fillColor(COLORS.accentDark)
    .font('Helvetica-Bold')
    .fontSize(8.5)
    .text('Universidad Autónoma de Santo Domingo', PAGE_MARGIN, y, {
      width: 330,
    });
  doc
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(8)
    .text(
      `${data.student.matricula} - ${data.student.name}`,
      PAGE_MARGIN + 300,
      y,
      {
        align: 'right',
        width: CONTENT_WIDTH - 300,
      },
    );
  doc
    .moveTo(PAGE_MARGIN, y + 14)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y + 14)
    .lineWidth(0.7)
    .strokeColor(COLORS.border)
    .stroke();
  doc.y = y + 24;
}

function renderPeriod(
  doc: PDFKit.PDFDocument,
  data: HistoryDocument,
  period: string,
  records: HistoryRecord[],
): void {
  startPeriod(doc, data, period, false);

  records.forEach((record, index) => {
    const values = recordValues(record);
    const height = measureRow(doc, values);
    if (!fits(doc, height + 1)) {
      addPage(doc, data);
      startPeriod(doc, data, period, true);
    }
    drawCells(doc, values, index % 2 ? COLORS.rowAlternate : COLORS.white);
  });

  doc.y += 12;
}

function startPeriod(
  doc: PDFKit.PDFDocument,
  data: HistoryDocument,
  period: string,
  continuation: boolean,
): void {
  if (!fits(doc, 60)) addPage(doc, data);
  const y = doc.y;
  const label = `${periodLabel(period)}${continuation ? ' (continuación)' : ''}`;

  doc
    .roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 24, 3)
    .fillColor(COLORS.accent)
    .fill();
  doc
    .fillColor(COLORS.white)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(label, PAGE_MARGIN + 9, y + 6, {
      width: CONTENT_WIDTH - 18,
      height: 13,
    });
  doc.y = y + 28;
  drawCells(
    doc,
    COLUMNS.map((column) => column.label),
    COLORS.headerFill,
    true,
  );
}

function recordValues(record: HistoryRecord): string[] {
  const grade = record.calificacion?.toNumber();
  const finalGrade =
    grade === undefined
      ? statusLiteral(record.estado_asignatura)
      : formatNumber(grade);
  const displayedGrade = record.calificacion_laboratorio_literal
    ? `${finalGrade}\nLab: ${record.calificacion_laboratorio_literal}`
    : finalGrade;
  return [
    record.asignaturas.codigo,
    record.asignaturas.nombre,
    displayedGrade,
    statusLabel(record.estado_asignatura),
    formatNumber(record.asignaturas.creditos.toNumber()),
  ];
}

function drawCells(
  doc: PDFKit.PDFDocument,
  values: string[],
  fill: string,
  header = false,
): void {
  const startY = doc.y;
  const font = header ? 'Helvetica-Bold' : 'Helvetica';
  const fontSize = header ? 7.4 : 8;
  doc.font(font).fontSize(fontSize);
  const height = Math.max(
    header ? 25 : 24,
    ...values.map(
      (value, index) =>
        doc.heightOfString(value, {
          width: COLUMNS[index].width - 8,
          lineGap: 0.6,
        }) + 9,
    ),
  );
  let x = PAGE_MARGIN;

  values.forEach((value, index) => {
    const column = COLUMNS[index];
    const textHeight = doc.heightOfString(value, {
      width: column.width - 8,
      lineGap: 0.6,
    });
    doc
      .rect(x, startY, column.width, height)
      .fillAndStroke(fill, COLORS.border);
    doc
      .fillColor(header ? COLORS.accentDark : COLORS.text)
      .font(font)
      .fontSize(fontSize)
      .text(value, x + 4, startY + Math.max(4, (height - textHeight) / 2), {
        align: column.align,
        height: height - 7,
        lineGap: 0.6,
        width: column.width - 8,
      });
    x += column.width;
  });
  doc.y = startY + height;
}

function measureRow(doc: PDFKit.PDFDocument, values: string[]): number {
  doc.font('Helvetica').fontSize(8);
  return Math.max(
    24,
    ...values.map(
      (value, index) =>
        doc.heightOfString(value, {
          width: COLUMNS[index].width - 8,
          lineGap: 0.6,
        }) + 9,
    ),
  );
}

function renderSummary(doc: PDFKit.PDFDocument, data: HistoryDocument): void {
  if (!fits(doc, 128)) addPage(doc, data);
  const approved = data.history.filter((record) =>
    ['APROBADA', 'CONVALIDADA'].includes(record.estado_asignatura),
  );
  const approvedCredits = approved.reduce(
    (total, record) => total + record.asignaturas.creditos.toNumber(),
    0,
  );
  const graded = data.history.filter((record) => record.calificacion !== null);
  const gradedCredits = graded.reduce(
    (total, record) => total + record.asignaturas.creditos.toNumber(),
    0,
  );
  const qualityPoints = graded.reduce(
    (total, record) =>
      total +
      record.calificacion!.toNumber() * record.asignaturas.creditos.toNumber(),
    0,
  );
  const average = gradedCredits ? qualityPoints / gradedCredits : 0;
  const y = doc.y;

  doc
    .roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 104, 4)
    .fillAndStroke(COLORS.summaryFill, COLORS.border);
  doc
    .fillColor(COLORS.accentDark)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('Resumen del histórico', PAGE_MARGIN + 12, y + 11, {
      width: CONTENT_WIDTH - 24,
    });

  const stats = [
    ['Registros', String(data.history.length)],
    ['Aprobadas', String(approved.length)],
    ['Créditos aprobados', formatNumber(approvedCredits)],
    ['Promedio', formatNumber(average)],
  ];
  stats.forEach(([label, value], index) => {
    const x = PAGE_MARGIN + 12 + index * 132;
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(7.5)
      .text(label, x, y + 40, { width: 120 });
    doc
      .fillColor(COLORS.accentDark)
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(value, x, y + 54, { width: 120 });
  });
  doc.y = y + 116;
}

function renderFooters(doc: PDFKit.PDFDocument, matricula: string): void {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const y = PAGE_BOTTOM + 12;
    doc
      .moveTo(PAGE_MARGIN, y - 6)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, y - 6)
      .lineWidth(0.5)
      .strokeColor(COLORS.border)
      .stroke();
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(7.5)
      .text(`Histórico ${matricula}`, PAGE_MARGIN, y, {
        lineBreak: false,
        width: 180,
      });
    doc.text(`Página ${index - range.start + 1} de ${range.count}`, 432, y, {
      align: 'right',
      lineBreak: false,
      width: 148,
    });
  }
}

function groupByPeriod(records: HistoryRecord[]): Map<string, HistoryRecord[]> {
  const grouped = new Map<string, HistoryRecord[]>();
  for (const record of records) {
    grouped.set(record.periodo_codigo, [
      ...(grouped.get(record.periodo_codigo) ?? []),
      record,
    ]);
  }
  return grouped;
}

function addPage(doc: PDFKit.PDFDocument, data: HistoryDocument): void {
  doc.addPage();
  renderContinuationHeader(doc, data);
}

function fits(doc: PDFKit.PDFDocument, required: number): boolean {
  return doc.y + required <= PAGE_BOTTOM;
}

function periodLabel(code: string): string {
  const match = code.match(/^(\d{4})-(\d{2})$/);
  if (!match) return code;
  const terms: Record<string, string> = {
    '10': 'Primer semestre',
    '15': 'Verano',
    '20': 'Segundo semestre',
    '30': 'Tercer semestre',
  };
  return `${terms[match[2]] ?? `Período ${match[2]}`} ${match[1]}`;
}

function statusLiteral(status: string): string {
  return status === 'RETIRADA' ? 'AUS' : statusLabel(status);
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    APROBADA: 'Aprobada',
    CONVALIDADA: 'Convalidada',
    CURSANDO: 'Cursando',
    PENDIENTE: 'Pendiente',
    REPROBADA: 'Reprobada',
    RETIRADA: 'Retirada',
  };
  return labels[status] ?? status;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function toBigInt(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestException('Identificador de carrera inválido.');
  }
}
