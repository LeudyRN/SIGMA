import { BadRequestException, Injectable } from '@nestjs/common';

import PDFDocument from 'pdfkit';

import type {
  planes_estudioDefaultArgs,
  planes_estudioGetPayload,
} from '../../generated/prisma/models/planes_estudio';
import { PrismaService } from '../../prisma/prisma.service';

const PLAN_QUERY = {
  include: {
    carreras: {
      include: {
        escuelas: {
          include: {
            facultades: true,
          },
        },
      },
    },
    plan_estudio_asignaturas: {
      include: {
        asignaturas: true,
      },
      orderBy: [
        { semestre: 'asc' },
        { orden: 'asc' },
        { asignaturas: { codigo: 'asc' } },
      ],
    },
  },
} satisfies planes_estudioDefaultArgs;

type StudyPlanExport = planes_estudioGetPayload<typeof PLAN_QUERY>;
type StudyPlanSubject = StudyPlanExport['plan_estudio_asignaturas'][number];
type CellAlignment = 'left' | 'center' | 'right';

interface TableColumn {
  label: string;
  width: number;
  align?: CellAlignment;
}

interface CellStyle {
  fill?: string;
  font?: 'Helvetica' | 'Helvetica-Bold';
  fontSize?: number;
  minimumHeight?: number;
  textColor?: string;
}

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

const TABLE_COLUMNS: TableColumn[] = [
  { label: 'Clave', width: 50 },
  { label: 'Asignatura', width: 144 },
  { label: 'HT', width: 28, align: 'center' },
  { label: 'HP', width: 28, align: 'center' },
  { label: 'CR', width: 30, align: 'center' },
  { label: 'Prerrequisitos', width: 150 },
  { label: 'Equivalencias', width: 118 },
];

@Injectable()
export class StudyPlanPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async exportPlan(planId: string): Promise<Buffer> {
    const plan = await this.prisma.planes_estudio.findUnique({
      where: {
        id_plan_estudio: toBigInt(planId),
      },
      ...PLAN_QUERY,
    });

    if (!plan) {
      throw new BadRequestException('Plan de estudios no encontrado.');
    }

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

      doc.on('data', (chunk: Uint8Array) => {
        chunks.push(Buffer.from(chunk));
      });
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      doc.on('error', reject);

      const regular = plan.plan_estudio_asignaturas.filter(
        (item) => item.tipo === 'REGULAR',
      );
      const optional = plan.plan_estudio_asignaturas.filter(
        (item) => item.tipo === 'OPTATIVA',
      );
      const thesis = plan.plan_estudio_asignaturas.filter(
        (item) => item.tipo === 'TESIS',
      );

      renderDocumentHeader(doc, plan);
      renderSubjects(doc, plan, regular);

      if (thesis.length) {
        renderTableSection(doc, plan, 'Tesis de grado', thesis);
      }

      if (optional.length) {
        renderSubjects(doc, plan, optional, 'Asignaturas optativas');
      }

      // Las optativas disponibles no se suman como si todas fueran obligatorias.
      renderSummary(doc, plan, [...regular, ...thesis]);
      renderPageFooters(doc, plan);
      doc.end();
    });
  }
}

function renderDocumentHeader(
  doc: PDFKit.PDFDocument,
  plan: StudyPlanExport,
): void {
  const faculty = plan.carreras.escuelas.facultades.nombre;
  const school = plan.carreras.escuelas.nombre;
  const leftWidth = 370;
  const rightX = PAGE_MARGIN + 390;
  const rightWidth = CONTENT_WIDTH - 390;
  const top = PAGE_MARGIN;

  doc
    .fillColor(COLORS.accentDark)
    .font('Helvetica-Bold')
    .fontSize(16)
    .text('Universidad Autónoma de Santo Domingo', PAGE_MARGIN, top, {
      width: leftWidth,
    });
  doc.moveDown(0.3);
  doc.fontSize(11).text(faculty, { width: leftWidth });
  doc
    .fillColor(COLORS.text)
    .font('Helvetica')
    .fontSize(9.5)
    .text(school, { width: leftWidth })
    .text(plan.carreras.nombre, { width: leftWidth });
  const leftBottom = doc.y;

  doc
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(8)
    .text('PLAN DE ESTUDIOS', rightX, top + 2, {
      align: 'right',
      width: rightWidth,
    });
  doc
    .fillColor(COLORS.accentDark)
    .font('Helvetica-Bold')
    .fontSize(13)
    .text(plan.codigo, rightX, doc.y + 2, {
      align: 'right',
      width: rightWidth,
    });
  doc
    .fillColor(COLORS.text)
    .font('Helvetica')
    .fontSize(9)
    .text(`Carrera ${plan.carreras.codigo}`, rightX, doc.y + 3, {
      align: 'right',
      width: rightWidth,
    });
  const rightBottom = doc.y;
  const dividerY = Math.max(leftBottom, rightBottom) + 11;

  doc
    .moveTo(PAGE_MARGIN, dividerY)
    .lineTo(PAGE_MARGIN + CONTENT_WIDTH, dividerY)
    .lineWidth(1.2)
    .strokeColor(COLORS.accent)
    .stroke();
  doc.y = dividerY + 12;
}

function renderContinuationHeader(
  doc: PDFKit.PDFDocument,
  plan: StudyPlanExport,
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
      `Plan ${plan.codigo} - ${plan.carreras.codigo}`,
      PAGE_MARGIN + 350,
      y,
      {
        align: 'right',
        width: CONTENT_WIDTH - 350,
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

function renderSubjects(
  doc: PDFKit.PDFDocument,
  plan: StudyPlanExport,
  subjects: StudyPlanSubject[],
  category?: string,
): void {
  const grouped = new Map<number, StudyPlanSubject[]>();

  for (const subject of subjects) {
    const semester = subject.semestre ?? 0;
    grouped.set(semester, [...(grouped.get(semester) ?? []), subject]);
  }

  for (const [semester, values] of grouped) {
    const semesterLabel = semester
      ? `${semesterName(semester)} semestre`
      : 'Sin semestre asignado';
    const sectionTitle = category
      ? `${category} - ${semesterLabel}`
      : semesterLabel;

    renderTableSection(doc, plan, sectionTitle, values);
  }
}

function renderTableSection(
  doc: PDFKit.PDFDocument,
  plan: StudyPlanExport,
  sectionTitle: string,
  subjects: StudyPlanSubject[],
): void {
  startTableSection(doc, plan, sectionTitle, false);

  subjects.forEach((subject, index) => {
    const values = subjectValues(subject);
    const rowHeight = measureRowHeight(doc, values);

    if (!fitsOnPage(doc, rowHeight)) {
      addContentPage(doc, plan);
      startTableSection(doc, plan, sectionTitle, true);
    }

    drawCells(doc, values, {
      fill: index % 2 === 1 ? COLORS.rowAlternate : COLORS.white,
    });
  });

  if (!fitsOnPage(doc, 27)) {
    addContentPage(doc, plan);
    startTableSection(doc, plan, sectionTitle, true);
  }

  renderSemesterTotal(doc, subjects);
  doc.y += 12;
}

function startTableSection(
  doc: PDFKit.PDFDocument,
  plan: StudyPlanExport,
  sectionTitle: string,
  continuation: boolean,
): void {
  if (!fitsOnPage(doc, 66)) {
    addContentPage(doc, plan);
  }

  const label = continuation ? `${sectionTitle} (continuación)` : sectionTitle;
  const y = doc.y;

  doc
    .roundedRect(PAGE_MARGIN, y, CONTENT_WIDTH, 24, 3)
    .fillColor(COLORS.accent)
    .fill();
  doc
    .fillColor(COLORS.white)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text(label, PAGE_MARGIN + 9, y + 6, {
      height: 13,
      width: CONTENT_WIDTH - 18,
    });
  doc.y = y + 28;
  drawTableHeader(doc);
}

function drawTableHeader(doc: PDFKit.PDFDocument): void {
  drawCells(
    doc,
    TABLE_COLUMNS.map((column) => column.label),
    {
      fill: COLORS.headerFill,
      font: 'Helvetica-Bold',
      fontSize: 7.2,
      minimumHeight: 25,
      textColor: COLORS.accentDark,
    },
  );
}

function subjectValues(relation: StudyPlanSubject): string[] {
  const subject = relation.asignaturas;

  return [
    subject.codigo,
    subject.nombre,
    String(subject.horas_teoricas ?? 0),
    String(subject.horas_practicas ?? 0),
    String(relation.creditos_plan ?? subject.creditos),
    relation.prerrequisitos_texto ?? '',
    relation.equivalencias_texto ?? '',
  ];
}

function measureRowHeight(doc: PDFKit.PDFDocument, values: string[]): number {
  doc.font('Helvetica').fontSize(7.4);

  return Math.max(
    24,
    ...values.map(
      (value, index) =>
        doc.heightOfString(String(value), {
          lineGap: 0.6,
          width: TABLE_COLUMNS[index].width - 8,
        }) + 9,
    ),
  );
}

function drawCells(
  doc: PDFKit.PDFDocument,
  values: string[],
  style: CellStyle = {},
): void {
  const startY = doc.y;
  const font = style.font ?? 'Helvetica';
  const fontSize = style.fontSize ?? 7.4;

  doc.font(font).fontSize(fontSize);

  const height = Math.max(
    style.minimumHeight ?? 24,
    ...values.map(
      (value, index) =>
        doc.heightOfString(String(value), {
          lineGap: 0.6,
          width: TABLE_COLUMNS[index].width - 8,
        }) + 9,
    ),
  );
  let x = PAGE_MARGIN;

  values.forEach((value, index) => {
    const column = TABLE_COLUMNS[index];
    const text = String(value);
    const textHeight = doc.heightOfString(text, {
      lineGap: 0.6,
      width: column.width - 8,
    });
    const textY = startY + Math.max(4, (height - textHeight) / 2);

    doc
      .rect(x, startY, column.width, height)
      .fillAndStroke(style.fill ?? COLORS.white, COLORS.border);
    doc
      .fillColor(style.textColor ?? COLORS.text)
      .font(font)
      .fontSize(fontSize)
      .text(text, x + 4, textY, {
        align: column.align ?? 'left',
        height: height - 7,
        lineGap: 0.6,
        width: column.width - 8,
      });
    x += column.width;
  });

  doc.y = startY + height;
}

function renderSemesterTotal(
  doc: PDFKit.PDFDocument,
  values: StudyPlanSubject[],
): void {
  const ht = values.reduce(
    (sum, item) => sum + Number(item.asignaturas.horas_teoricas ?? 0),
    0,
  );
  const hp = values.reduce(
    (sum, item) => sum + Number(item.asignaturas.horas_practicas ?? 0),
    0,
  );
  const credits = values.reduce(
    (sum, item) =>
      sum + Number(item.creditos_plan ?? item.asignaturas.creditos),
    0,
  );

  drawCells(
    doc,
    ['', 'Totales', String(ht), String(hp), String(credits), '', ''],
    {
      fill: COLORS.summaryFill,
      font: 'Helvetica-Bold',
      fontSize: 7.4,
      minimumHeight: 25,
      textColor: COLORS.accentDark,
    },
  );
}

function renderSummary(
  doc: PDFKit.PDFDocument,
  plan: StudyPlanExport,
  requiredSubjects: StudyPlanSubject[],
): void {
  const ht = requiredSubjects.reduce(
    (sum, item) => sum + Number(item.asignaturas.horas_teoricas ?? 0),
    0,
  );
  const hp = requiredSubjects.reduce(
    (sum, item) => sum + Number(item.asignaturas.horas_practicas ?? 0),
    0,
  );
  const calculatedCredits = requiredSubjects.reduce(
    (sum, item) =>
      sum + Number(item.creditos_plan ?? item.asignaturas.creditos),
    0,
  );
  const credits = plan.creditos_totales
    ? Number(plan.creditos_totales)
    : calculatedCredits;

  if (!fitsOnPage(doc, 132)) {
    addContentPage(doc, plan);
  }

  const startY = doc.y;

  doc
    .roundedRect(PAGE_MARGIN, startY, CONTENT_WIDTH, 118, 4)
    .fillAndStroke(COLORS.summaryFill, COLORS.border);
  doc
    .fillColor(COLORS.accentDark)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('Resumen del plan', PAGE_MARGIN + 12, startY + 11, {
      width: CONTENT_WIDTH - 24,
    });

  const statY = startY + 36;
  const statWidth = 92;
  const statGap = 10;
  const stats = [
    ['HT', formatNumber(ht)],
    ['HP', formatNumber(hp)],
    ['Créditos', formatNumber(credits)],
  ];

  stats.forEach(([label, value], index) => {
    const x = PAGE_MARGIN + 12 + index * (statWidth + statGap);

    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(7.5)
      .text(label, x, statY, { width: statWidth });
    doc
      .fillColor(COLORS.accentDark)
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(value, x, statY + 12, { width: statWidth });
  });

  doc
    .fillColor(COLORS.accentDark)
    .font('Helvetica-Bold')
    .fontSize(8)
    .text('Leyenda', PAGE_MARGIN + 326, statY, { width: 198 });
  doc
    .fillColor(COLORS.text)
    .font('Helvetica')
    .fontSize(7.5)
    .text(
      'HT: Horas Teóricas | HP: Horas Prácticas | CR: Créditos\n' +
        'En prerrequisitos, la barra (/) indica "o" y la coma indica "y". ' +
        'Los códigos entre paréntesis son co-requisitos.',
      PAGE_MARGIN + 326,
      statY + 13,
      { lineGap: 1, width: 198 },
    );
  doc.y = startY + 130;
}

function renderPageFooters(
  doc: PDFKit.PDFDocument,
  plan: StudyPlanExport,
): void {
  const range = doc.bufferedPageRange();

  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    const footerY = PAGE_BOTTOM + 12;

    doc
      .moveTo(PAGE_MARGIN, footerY - 6)
      .lineTo(PAGE_MARGIN + CONTENT_WIDTH, footerY - 6)
      .lineWidth(0.5)
      .strokeColor(COLORS.border)
      .stroke();
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(7.5)
      .text(`Plan ${plan.codigo}`, PAGE_MARGIN, footerY, {
        lineBreak: false,
        width: 150,
      });
    doc.text(
      `Página ${index - range.start + 1} de ${range.count}`,
      432,
      footerY,
      {
        align: 'right',
        lineBreak: false,
        width: 148,
      },
    );
  }
}

function addContentPage(doc: PDFKit.PDFDocument, plan: StudyPlanExport): void {
  doc.addPage();
  renderContinuationHeader(doc, plan);
}

function fitsOnPage(doc: PDFKit.PDFDocument, requiredHeight: number): boolean {
  return doc.y + requiredHeight <= PAGE_BOTTOM;
}

function semesterName(semester: number): string {
  const names = [
    '',
    'Primer',
    'Segundo',
    'Tercer',
    'Cuarto',
    'Quinto',
    'Sexto',
    'Séptimo',
    'Octavo',
    'Noveno',
    'Décimo',
    'Undécimo',
    'Duodécimo',
  ];

  return names[semester] ?? `${semester}.º`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function toBigInt(value: string): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestException('Plan de estudios inválido.');
  }
}
