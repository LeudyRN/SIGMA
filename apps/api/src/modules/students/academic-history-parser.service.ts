import { BadRequestException, Injectable } from '@nestjs/common';

export type AcademicHistoryStatus =
  | 'APROBADA'
  | 'REPROBADA'
  | 'RETIRADA'
  | 'CURSANDO'
  | 'PENDIENTE'
  | 'CONVALIDADA';

export interface ParsedAcademicHistoryRecord {
  campus: string;
  career: string;
  courseCode: string;
  credits: number;
  grade: number | null;
  gradeText: string;
  laboratoryGrade: number | null;
  laboratoryGradeText: string | null;
  periodCode: string;
  periodLabel: string;
  qualityPoints: number | null;
  status: AcademicHistoryStatus | null;
  subjectName: string;
}

export interface AcademicHistoryIssue {
  code: string;
  message: string;
  periodCode?: string;
  severity: 'ERROR' | 'WARNING';
  subjectCode?: string;
}

export interface ParsedAcademicHistory {
  career: string;
  issues: AcademicHistoryIssue[];
  matricula: string;
  records: ParsedAcademicHistoryRecord[];
  school: string;
  studentName: string;
}

interface PositionedItem {
  text: string;
  x: number;
  y: number;
}

interface PositionedLine {
  items: PositionedItem[];
  y: number;
}

interface HistoryColumns {
  campus: number;
  course: number;
  credits: number;
  grade: number;
  level: number;
  qualityPoints: number;
  subjectArea: number;
  subjectName: number;
}

interface HistoryCells {
  campus: string;
  course: string;
  credits: string;
  grade: string;
  level: string;
  qualityPoints: string;
  subjectArea: string;
  subjectName: string;
}

@Injectable()
export class AcademicHistoryParserService {
  async parse(buffer: Buffer): Promise<ParsedAcademicHistory> {
    let pdfjs: typeof import('pdfjs-dist/legacy/build/pdf.mjs');

    try {
      pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    } catch {
      throw new BadRequestException(
        'No fue posible cargar el lector de históricos académicos.',
      );
    }

    let document: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>;

    try {
      document = await pdfjs.getDocument({
        data: new Uint8Array(buffer),
      }).promise;
    } catch {
      throw new BadRequestException(
        'No fue posible leer el PDF. Verifica que sea un histórico académico válido.',
      );
    }

    const pages: PositionedLine[][] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const items: PositionedItem[] = [];

      for (const item of content.items) {
        if (!('str' in item)) continue;
        const text = cleanText(item.str);
        if (!text) continue;

        items.push({
          text,
          x: Number(item.transform[4] ?? 0),
          y: Number(item.transform[5] ?? 0),
        });
      }

      pages.push(groupIntoLines(items));
    }

    const allLines = pages.flat();
    const completeText = allLines.map(lineText).join('\n');

    if (!/Hist[oó]rico Acad[eé]mico/i.test(completeText)) {
      throw new BadRequestException(
        'El documento no tiene la estructura de un histórico académico.',
      );
    }

    const identity = parseIdentity(allLines);
    const parsedRecords: ParsedAcademicHistoryRecord[] = [];
    let columns: HistoryColumns | null = null;
    let currentCareer = identity.career;
    let currentPeriod: { code: string; label: string } | null = null;
    let inTable = false;
    let lastRecord: ParsedAcademicHistoryRecord | null = null;

    for (const lines of pages) {
      for (const line of lines) {
        const text = lineText(line);
        const period = parsePeriod(text);

        if (period) {
          currentPeriod = period;
          inTable = false;
          lastRecord = null;
          continue;
        }

        const careerMatch = text.match(/^Carrera:\s*(.+)$/i);
        if (currentPeriod && careerMatch) {
          currentCareer = cleanText(careerMatch[1]);
          continue;
        }

        const detectedColumns = detectColumns(line);
        if (detectedColumns) {
          columns = detectedColumns;
          inTable = true;
          lastRecord = null;
          continue;
        }

        if (/^Totales\s+Periodo/i.test(text)) {
          inTable = false;
          lastRecord = null;
          continue;
        }

        if (!inTable || !columns || !currentPeriod || isIgnoredLine(text)) {
          continue;
        }

        const cells = splitIntoCells(line, columns);
        const subjectArea = normalizeCodePart(cells.subjectArea);
        const course = normalizeCodePart(cells.course);

        if (!isSubjectArea(subjectArea) || !isCourseNumber(course)) {
          if (
            lastRecord &&
            cells.campus &&
            !cells.grade &&
            !cells.credits &&
            !cells.subjectName
          ) {
            lastRecord.campus = cleanText(
              `${lastRecord.campus} ${cells.campus}`,
            );
          }
          continue;
        }

        const courseCode = `${subjectArea}${course}`;
        const gradeText = normalizeGradeText(cells.grade);
        const laboratoryResult = classifyLaboratoryGrade(gradeText);
        const gradeResult =
          laboratoryResult ?? classifyAcademicGrade(gradeText);
        const credits = parseDecimal(cells.credits);

        const record: ParsedAcademicHistoryRecord = {
          campus: cleanText(cells.campus),
          career: currentCareer,
          courseCode,
          credits: credits ?? 0,
          grade: laboratoryResult ? null : gradeResult.grade,
          gradeText,
          laboratoryGrade: laboratoryResult?.grade ?? null,
          laboratoryGradeText: laboratoryResult
            ? `L${formatGrade(laboratoryResult.grade)}`
            : null,
          periodCode: currentPeriod.code,
          periodLabel: currentPeriod.label,
          qualityPoints: parseDecimal(cells.qualityPoints),
          status: gradeResult.status,
          subjectName: cleanText(cells.subjectName),
        };

        parsedRecords.push(record);
        lastRecord = record;
      }
    }

    const { issues, records } = validateAndDeduplicate(parsedRecords);

    if (!records.length) {
      throw new BadRequestException(
        'El histórico fue reconocido, pero no contiene asignaturas importables.',
      );
    }

    return {
      ...identity,
      issues,
      records,
    };
  }
}

function parseIdentity(
  lines: PositionedLine[],
): Omit<ParsedAcademicHistory, 'issues' | 'records'> {
  const texts = lines.map(lineText);
  let matricula = '';
  let studentName = '';

  for (const text of texts.slice(0, 80)) {
    const match = text.match(/\b(\d{8,12})\b\s+(.+)/);
    if (!match) continue;
    matricula = match[1];
    studentName = cleanText(match[2]);
    break;
  }

  const programIndex = texts.findIndex((text) =>
    /^Programa Actual$/i.test(text),
  );
  const metadataWindow = texts.slice(
    Math.max(programIndex, 0),
    programIndex >= 0 ? programIndex + 20 : 80,
  );
  const career = metadataValue(metadataWindow, 'Programa');
  const school = metadataValue(metadataWindow, 'Escuela');

  const missing: string[] = [];
  if (!matricula) missing.push('matrícula');
  if (!studentName) missing.push('nombre del estudiante');
  if (!career) missing.push('programa o carrera');

  if (missing.length) {
    throw new BadRequestException(
      `No fue posible identificar: ${missing.join(', ')}.`,
    );
  }

  return {
    career,
    matricula,
    school,
    studentName,
  };
}

function metadataValue(lines: string[], label: string): string {
  const expression = new RegExp(`^${label}:\\s*(.+)$`, 'i');

  for (const line of lines) {
    const match = line.match(expression);
    if (match) return cleanText(match[1]);
  }

  return '';
}

function detectColumns(line: PositionedLine): HistoryColumns | null {
  const indexed = line.items.map((item) => ({
    ...item,
    key: normalizeHeader(item.text),
  }));
  const subjectArea = indexed.find((item) => item.key === 'materia');
  const course = indexed.find((item) => item.key === 'curso');
  const campus = indexed.find((item) => item.key === 'campus');
  const level = indexed.find((item) => item.key === 'nivel');
  const subjectName = indexed.find((item) => item.key === 'titulo');
  const grade = indexed.find((item) => item.key === 'calificacion');
  const credits = indexed.find(
    (item) => item.key === 'horas' && grade && item.x > grade.x,
  );
  const qualityPoints = indexed.find((item) => item.key === 'puntos');

  if (
    !subjectArea ||
    !course ||
    !campus ||
    !level ||
    !subjectName ||
    !grade ||
    !credits ||
    !qualityPoints
  ) {
    return null;
  }

  return {
    subjectArea: subjectArea.x,
    course: course.x,
    campus: campus.x,
    level: level.x,
    subjectName: subjectName.x,
    grade: grade.x,
    credits: credits.x,
    qualityPoints: qualityPoints.x,
  };
}

function splitIntoCells(
  line: PositionedLine,
  columns: HistoryColumns,
): HistoryCells {
  const cells: HistoryCells = {
    campus: '',
    course: '',
    credits: '',
    grade: '',
    level: '',
    qualityPoints: '',
    subjectArea: '',
    subjectName: '',
  };
  const boundaries = {
    course: midpoint(columns.subjectArea, columns.course),
    campus: midpoint(columns.course, columns.campus),
    level: midpoint(columns.campus, columns.level),
    subjectName: midpoint(columns.level, columns.subjectName),
    grade: midpoint(columns.subjectName, columns.grade),
    credits: midpoint(columns.grade, columns.credits),
    qualityPoints: midpoint(columns.credits, columns.qualityPoints),
  };

  for (const item of line.items) {
    if (item.x < boundaries.course) {
      cells.subjectArea = append(cells.subjectArea, item.text);
    } else if (item.x < boundaries.campus) {
      cells.course = append(cells.course, item.text);
    } else if (item.x < boundaries.level) {
      cells.campus = append(cells.campus, item.text);
    } else if (item.x < boundaries.subjectName) {
      cells.level = append(cells.level, item.text);
    } else if (item.x < boundaries.grade) {
      cells.subjectName = append(cells.subjectName, item.text);
    } else if (item.x < boundaries.credits) {
      cells.grade = append(cells.grade, item.text);
    } else if (item.x < boundaries.qualityPoints) {
      cells.credits = append(cells.credits, item.text);
    } else {
      cells.qualityPoints = append(cells.qualityPoints, item.text);
    }
  }

  return cells;
}

function validateAndDeduplicate(records: ParsedAcademicHistoryRecord[]): {
  issues: AcademicHistoryIssue[];
  records: ParsedAcademicHistoryRecord[];
} {
  const grouped = new Map<string, ParsedAcademicHistoryRecord[]>();

  for (const record of records) {
    const key = `${record.periodCode}:${record.courseCode}`;
    grouped.set(key, [...(grouped.get(key) ?? []), record]);
  }

  const issues: AcademicHistoryIssue[] = [];
  const validRecords: ParsedAcademicHistoryRecord[] = [];

  for (const values of grouped.values()) {
    const laboratory = values.filter(
      (record) => record.laboratoryGrade !== null,
    );
    const regular = values.filter((record) => record.laboratoryGrade === null);
    const valid = regular.filter((record) => record.status !== null);
    const invalid = regular.filter((record) => record.status === null);
    const laboratoryRecord = laboratory.find(
      (record) => record.status !== null,
    );

    if (valid.length) {
      const selected = {
        ...valid[0],
        laboratoryGrade:
          laboratoryRecord?.laboratoryGrade ?? valid[0].laboratoryGrade,
        laboratoryGradeText:
          laboratoryRecord?.laboratoryGradeText ?? valid[0].laboratoryGradeText,
      };
      validRecords.push(selected);

      if (invalid.length) {
        issues.push({
          code: 'INFORMATIONAL_DUPLICATE_OMITTED',
          message: `Se omitió ${selected.courseCode} con literal ${invalid[0].gradeText || 'vacío'} porque ya existe una calificación válida en el mismo período.`,
          periodCode: selected.periodCode,
          severity: 'WARNING',
          subjectCode: selected.courseCode,
        });
      }

      const conflicting = valid.find(
        (record) =>
          record.grade !== selected.grade || record.status !== selected.status,
      );
      if (conflicting) {
        issues.push({
          code: 'CONFLICTING_DUPLICATE',
          message: `${selected.courseCode} tiene resultados distintos en ${selected.periodCode}.`,
          periodCode: selected.periodCode,
          severity: 'ERROR',
          subjectCode: selected.courseCode,
        });
      }
      continue;
    }

    if (laboratoryRecord) {
      validRecords.push(laboratoryRecord);
      continue;
    }

    const record = invalid[0];
    issues.push({
      code: 'UNKNOWN_GRADE',
      message: `El literal ${record.gradeText || 'vacío'} de ${record.courseCode} no representa una calificación o estado reconocido.`,
      periodCode: record.periodCode,
      severity: 'ERROR',
      subjectCode: record.courseCode,
    });
  }

  return { issues, records: validRecords };
}

export function classifyAcademicGrade(value: string): {
  grade: number | null;
  status: AcademicHistoryStatus | null;
} {
  const laboratory = classifyLaboratoryGrade(value);
  if (laboratory) return laboratory;

  if (/^\d{1,3}(?:[.,]\d{1,2})?$/.test(value)) {
    const grade = Number(value.replace(',', '.'));
    if (grade < 0 || grade > 100) return { grade: null, status: null };
    return {
      grade,
      status: grade >= 70 ? 'APROBADA' : 'REPROBADA',
    };
  }

  const normalized = removeDiacritics(value).replace(/\s+/g, '').toUpperCase();
  const statuses: Record<string, AcademicHistoryStatus> = {
    AP: 'APROBADA',
    APROBADA: 'APROBADA',
    AUS: 'RETIRADA',
    AUSENTE: 'RETIRADA',
    CONV: 'CONVALIDADA',
    CONVALIDADA: 'CONVALIDADA',
    CUR: 'CURSANDO',
    CURSANDO: 'CURSANDO',
    PEND: 'PENDIENTE',
    PENDIENTE: 'PENDIENTE',
    REP: 'REPROBADA',
    REPROBADA: 'REPROBADA',
    RET: 'RETIRADA',
    RETIRADA: 'RETIRADA',
  };

  return {
    grade: null,
    status: statuses[normalized] ?? null,
  };
}

export function classifyLaboratoryGrade(value: string): {
  grade: number;
  status: AcademicHistoryStatus;
} | null {
  const normalized = removeDiacritics(value).replace(/\s+/g, '').toUpperCase();
  const match = normalized.match(/^L(\d{1,2}(?:[.,]\d{1,2})?)$/);
  if (!match) return null;
  const grade = Number(match[1].replace(',', '.'));
  if (grade < 0 || grade > 30) return null;
  return {
    grade,
    status: grade >= 21 ? 'APROBADA' : 'REPROBADA',
  };
}

function formatGrade(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : String(value).replace('.', ',');
}

function parsePeriod(text: string): { code: string; label: string } | null {
  const normalized = removeDiacritics(text);
  const match = normalized.match(
    /^Periodo:\s*(Primer|Segundo|Tercer)\s+Semestre\s+(\d{4})$/i,
  );
  if (match) {
    const term = match[1].toLowerCase();
    const suffix = term === 'primer' ? '10' : term === 'segundo' ? '20' : '30';
    return { code: `${match[2]}-${suffix}`, label: cleanText(text.slice(8)) };
  }

  const summer = normalized.match(/^Periodo:\s*Verano\s+(\d{4})$/i);
  return summer
    ? { code: `${summer[1]}-15`, label: cleanText(text.slice(8)) }
    : null;
}

function groupIntoLines(items: PositionedItem[]): PositionedLine[] {
  const sorted = [...items].sort((left, right) => {
    if (Math.abs(left.y - right.y) > 2) return right.y - left.y;
    return left.x - right.x;
  });
  const lines: PositionedLine[] = [];

  for (const item of sorted) {
    let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= 3);
    if (!line) {
      line = { items: [], y: item.y };
      lines.push(line);
    }
    line.items.push(item);
  }

  for (const line of lines) line.items.sort((left, right) => left.x - right.x);
  return lines.sort((left, right) => right.y - left.y);
}

function lineText(line: PositionedLine): string {
  return cleanText(line.items.map((item) => item.text).join(' '));
}

function isIgnoredLine(value: string): boolean {
  return (
    /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(value) ||
    /^Hist[oó]rico Acad[eé]mico(?: No Oficial)?$/i.test(value) ||
    /^https?:\/\//i.test(value) ||
    /^\d+\/\d+$/.test(value)
  );
}

function isSubjectArea(value: string): boolean {
  return /^[A-Z]{2,5}$/.test(value);
}

function isCourseNumber(value: string): boolean {
  return /^[A-Z0-9]{4,5}$/.test(value);
}

function normalizeCodePart(value: string): string {
  return removeDiacritics(value)
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
}

function normalizeGradeText(value: string): string {
  return cleanText(value).toUpperCase();
}

function normalizeHeader(value: string): string {
  return removeDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function parseDecimal(value: string): number | null {
  const match = value.match(/-?\d+(?:[.,]\d+)?/);
  return match ? Number(match[0].replace(',', '.')) : null;
}

function append(previous: string, value: string): string {
  const next = cleanText(value);
  return previous && next ? `${previous} ${next}` : previous || next;
}

function midpoint(left: number, right: number): number {
  return left + (right - left) / 2;
}

function cleanText(value: string): string {
  return value
    .replace(/[\uFFFE\uFFFF\u00AD]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function removeDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
