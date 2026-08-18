import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import PDFDocument from 'pdfkit';

import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class StudyPlanPdfService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async exportPlan(
    planId: string,
  ): Promise<Buffer> {
    const plan =
      await this.prisma.planes_estudio.findUnique({
        where: {
          id_plan_estudio: toBigInt(planId),
        },

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
              {
                semestre: 'asc',
              },
              {
                orden: 'asc',
              },
              {
                asignaturas: {
                  codigo: 'asc',
                },
              },
            ],
          },
        },
      });

    if (!plan) {
      throw new BadRequestException(
        'Plan de estudios no encontrado.',
      );
    }

    return new Promise<Buffer>(
      (resolve, reject) => {
        const doc = new PDFDocument({
          size: 'LETTER',
          margins: {
            top: 36,
            bottom: 36,
            left: 30,
            right: 30,
          },
        });

        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => {
          chunks.push(
            Buffer.isBuffer(chunk)
              ? chunk
              : Buffer.from(chunk),
          );
        });

        doc.on('end', () => {
          resolve(Buffer.concat(chunks));
        });

        doc.on('error', reject);

        renderHeader(doc, plan);

        const regular =
          plan.plan_estudio_asignaturas.filter(
            (item) =>
              item.tipo === 'REGULAR',
          );

        const optional =
          plan.plan_estudio_asignaturas.filter(
            (item) =>
              item.tipo === 'OPTATIVA',
          );

        const thesis =
          plan.plan_estudio_asignaturas.filter(
            (item) =>
              item.tipo === 'TESIS',
          );

        renderSubjects(doc, regular);

        if (thesis.length) {
          title(doc, 'Tesis de Grado');

          tableHeader(doc);

          thesis.forEach((item) =>
            row(doc, item),
          );
        }

        if (optional.length) {
          doc.moveDown(1.5);

          doc
            .font('Helvetica-Bold')
            .fontSize(14)
            .text('Asignaturas Optativas');

          doc.moveDown(0.8);

          renderSubjects(doc, optional);
        }

        renderSummary(doc, plan);

        doc.end();
      },
    );
  }
}

function renderHeader(
  doc: PDFKit.PDFDocument,
  plan: any,
): void {
  const faculty =
    plan.carreras.escuelas.facultades.nombre;

  const school =
    plan.carreras.escuelas.nombre;

  doc
    .font('Helvetica-Bold')
    .fontSize(18)
    .text(
      'Universidad Autónoma de Santo Domingo',
    );

  doc.moveDown(0.35);

  doc
    .fontSize(13)
    .text(faculty);

  doc
    .font('Helvetica')
    .fontSize(11)
    .text(school)
    .text(plan.carreras.nombre);

  doc.moveUp(2.5);

  doc
    .font('Helvetica')
    .fontSize(10)
    .text(
      `Plan de estudios: ${plan.codigo}`,
      350,
      doc.y,
      {
        align: 'right',
      },
    );

  doc
    .text(
      plan.carreras.codigo,
      {
        align: 'right',
      },
    );

  doc.moveDown(2);
}

function renderSubjects(
  doc: PDFKit.PDFDocument,
  subjects: any[],
): void {
  const grouped = new Map<number, any[]>();

  for (const subject of subjects) {
    const semester =
      subject.semestre ?? 0;

    grouped.set(
      semester,
      [
        ...(grouped.get(semester) ?? []),
        subject,
      ],
    );
  }

  for (const [
    semester,
    values,
  ] of grouped) {
    ensurePage(doc, 150);

    if (semester) {
      title(
        doc,
        `${semesterName(semester)} Semestre`,
      );
    }

    tableHeader(doc);

    for (const value of values) {
      row(doc, value);
    }

    renderSemesterTotal(doc, values);

    doc.moveDown(0.8);
  }
}

function title(
  doc: PDFKit.PDFDocument,
  value: string,
): void {
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(value);

  doc.moveDown(0.45);
}

const widths = [
  55,
  155,
  35,
  35,
  35,
  155,
  110,
];

function tableHeader(
  doc: PDFKit.PDFDocument,
): void {
  ensurePage(doc, 70);

  const values = [
    'Clave',
    'Asignatura',
    'HT',
    'HP',
    'CR',
    'Prerrequisitos',
    'Equivalencias',
  ];

  drawCells(
    doc,
    values,
    true,
  );
}

function row(
  doc: PDFKit.PDFDocument,
  relation: any,
): void {
  const subject =
    relation.asignaturas;

  drawCells(doc, [
    subject.codigo,
    subject.nombre,

    String(
      subject.horas_teoricas ?? 0,
    ),

    String(
      subject.horas_practicas ?? 0,
    ),

    String(
      relation.creditos_plan ??
        subject.creditos,
    ),

    relation.prerrequisitos_texto ??
      '',

    relation.equivalencias_texto ??
      '',
  ]);
}

function drawCells(
  doc: PDFKit.PDFDocument,
  values: string[],
  header = false,
): void {
  const startX = doc.page.margins.left;
  const startY = doc.y;

  const height = Math.max(
    26,
    ...values.map((value, index) =>
      doc.heightOfString(
        String(value),
        {
          width: widths[index] - 8,
        },
      ) + 10,
    ),
  );

  ensurePage(doc, height + 10);

  let x = startX;

  doc
    .font(
      header
        ? 'Helvetica-Bold'
        : 'Helvetica',
    )
    .fontSize(8);

  values.forEach((value, index) => {
    const width = widths[index];

    doc
      .rect(x, startY, width, height)
      .stroke('#D5D9DE');

    doc.text(
      String(value),
      x + 4,
      startY + 5,
      {
        width: width - 8,
        height: height - 8,
      },
    );

    x += width;
  });

  doc.y = startY + height;
}

function renderSemesterTotal(
  doc: PDFKit.PDFDocument,
  values: any[],
): void {
  const ht = values.reduce(
    (sum, item) =>
      sum +
      Number(
        item.asignaturas
          .horas_teoricas ?? 0,
      ),
    0,
  );

  const hp = values.reduce(
    (sum, item) =>
      sum +
      Number(
        item.asignaturas
          .horas_practicas ?? 0,
      ),
    0,
  );

  const credits = values.reduce(
    (sum, item) =>
      sum +
      Number(
        item.creditos_plan ??
          item.asignaturas.creditos,
      ),
    0,
  );

  drawCells(doc, [
    '',
    '',
    String(ht),
    String(hp),
    String(credits),
    '',
    '',
  ]);
}

function renderSummary(
  doc: PDFKit.PDFDocument,
  plan: any,
): void {
  const subjects =
    plan.plan_estudio_asignaturas;

  const ht = subjects.reduce(
    (sum: number, item: any) =>
      sum +
      Number(
        item.asignaturas
          .horas_teoricas ?? 0,
      ),
    0,
  );

  const hp = subjects.reduce(
    (sum: number, item: any) =>
      sum +
      Number(
        item.asignaturas
          .horas_practicas ?? 0,
      ),
    0,
  );

  const credits = subjects.reduce(
    (sum: number, item: any) =>
      sum +
      Number(
        item.creditos_plan ??
          item.asignaturas.creditos,
      ),
    0,
  );

  doc.moveDown(1.5);

  ensurePage(doc, 120);

  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .text('Resumen');

  doc
    .font('Helvetica')
    .fontSize(10)
    .text(`Total HT: ${ht}`)
    .text(`Total HP: ${hp}`)
    .text(
      `Total Créditos: ${credits}`,
    );

  doc.moveDown();

  doc
    .font('Helvetica-Bold')
    .text('Leyenda');

  doc
    .font('Helvetica')
    .text(
      'HT: Horas Teóricas | HP: Horas Prácticas | CR: Créditos',
    )
    .text(
      'La barra (/) en los prerrequisitos indica "o", la coma indica "y". Los prerrequisitos encerrados entre paréntesis () son co-requisitos.',
    );
}

function ensurePage(
  doc: PDFKit.PDFDocument,
  required: number,
): void {
  const limit =
    doc.page.height -
    doc.page.margins.bottom;

  if (doc.y + required > limit) {
    doc.addPage();
  }
}

function semesterName(
  semester: number,
): string {
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

  return (
    names[semester] ??
    `${semester}.º`
  );
}

function toBigInt(
  value: string,
): bigint {
  try {
    return BigInt(value);
  } catch {
    throw new BadRequestException(
      'Plan de estudios inválido.',
    );
  }
}