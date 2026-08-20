import { BadRequestException, Injectable } from '@nestjs/common';

interface PositionedItem {
  text: string;
  x: number;
  y: number;
  width: number;
}

interface PositionedLine {
  y: number;
  items: PositionedItem[];
}

interface TableColumns {
  code: number;
  subject: number;
  ht: number;
  hp: number;
  credits: number;
  prerequisites: number;
  equivalences: number;
}

export interface ParsedStudyPlanSubject {
  code: string;
  name: string;

  theoreticalHours: number;
  practicalHours: number;
  credits: number;

  semester: number | null;

  prerequisiteText: string | null;
  equivalenceText: string | null;

  mandatory: boolean;

  type: 'REGULAR' | 'OPTATIVA' | 'TESIS';

  order: number;
}

export interface ParsedStudyPlan {
  planCode: string;

  careerCode: string;
  careerShortCode: string | null;

  university: string;
  faculty: string;
  school: string;
  career: string;

  totalTheoreticalHours: number | null;
  totalPracticalHours: number | null;
  totalCredits: number | null;

  subjects: ParsedStudyPlanSubject[];
}

@Injectable()
export class StudyPlanParserService {
  async parse(buffer: Buffer): Promise<ParsedStudyPlan> {
    let pdfjs: typeof import('pdfjs-dist/legacy/build/pdf.mjs');

    try {
      pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    } catch {
      throw new BadRequestException(
        'No fue posible cargar el lector de archivos PDF.',
      );
    }

    let document: Awaited<ReturnType<typeof pdfjs.getDocument>['promise']>;

    try {
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(buffer),
      });

      document = await loadingTask.promise;
    } catch {
      throw new BadRequestException(
        'No fue posible leer el PDF. Verifica que sea un plan de estudios válido.',
      );
    }

    const allLines: PositionedLine[][] = [];

    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);

      const content = await page.getTextContent();

      const items: PositionedItem[] = [];

      for (const item of content.items) {
        if (!('str' in item)) {
          continue;
        }

        const text = cleanText(item.str);

        if (!text) {
          continue;
        }

        items.push({
          text,
          x: Number(item.transform[4] ?? 0),
          y: Number(item.transform[5] ?? 0),
          width: Number(item.width ?? 0),
        });
      }

      allLines.push(groupIntoLines(items));
    }

    const completeText = allLines
      .flat()
      .map((line) => line.items.map((item) => item.text).join(' '))
      .join('\n');

    if (!/Plan de estudios/i.test(completeText)) {
      throw new BadRequestException(
        'El documento no tiene la estructura esperada de un plan de estudios.',
      );
    }

    const metadata = parseMetadata(completeText);

    const missingMetadata: string[] = [];

    if (!metadata.faculty) {
      missingMetadata.push('facultad');
    }

    if (!metadata.school) {
      missingMetadata.push('escuela');
    }

    if (!metadata.career) {
      missingMetadata.push('carrera');
    }

    if (!metadata.careerCode) {
      missingMetadata.push('código de carrera');
    }

    if (!metadata.planCode) {
      missingMetadata.push('código de plan');
    }

    if (missingMetadata.length) {
      throw new BadRequestException(
        `No fue posible identificar: ${missingMetadata.join(', ')}.`,
      );
    }

    const subjects = parsePages(allLines);

    console.log('[StudyPlanParser] asignaturas detectadas:', subjects.length);

    console.log(
      '[StudyPlanParser] primeras asignaturas:',
      subjects.slice(0, 5),
    );

    if (!subjects.length) {
      throw new BadRequestException(
        'El documento fue reconocido, pero no se encontraron asignaturas.',
      );
    }

    return {
      ...metadata,
      subjects,
    };
  }
}

/* ============================================================
 * METADATA
 * ============================================================ */

function parseMetadata(text: string): Omit<ParsedStudyPlan, 'subjects'> {
  const planCode =
    matchFirst(text, /Plan de estudios\s*:?\s*(\d{4,20})/i) ?? '';

  if (!planCode) {
    throw new BadRequestException(
      'No fue posible identificar el código del plan de estudios.',
    );
  }

  const careerMatch = text.match(
    /\b(\d{3,10})\s*-\s*([A-ZÁÉÍÓÚÑ0-9_-]{2,20})\b/i,
  );

  function findMetadataValue(text: string, pattern: RegExp): string | null {
    const lines = text
      .split('\n')
      .map((line) => normalizeSpaces(line))
      .filter(Boolean);

    return lines.find((line) => pattern.test(line)) ?? null;
  }

  const faculty = findMetadataValue(text, /^Facultad\b/i) ?? '';

  const school = findMetadataValue(text, /^Escuela\b/i) ?? '';

  const career = findCareer(text) ?? '';

  return {
    planCode,

    careerCode: careerMatch?.[1] ?? '',

    careerShortCode: careerMatch?.[2] ?? null,

    university: 'Universidad Autónoma de Santo Domingo',

    faculty,
    school,
    career,

    totalTheoreticalHours: numberMatch(text, /Total\s+HT\s*:\s*(\d+)/i),

    totalPracticalHours: numberMatch(text, /Total\s+HP\s*:\s*(\d+)/i),

    totalCredits: numberMatch(text, /Total\s+Creditos\s*:\s*(\d+)/i),
  };
}

function findCareer(text: string): string | null {
  const lines = text
    .split('\n')
    .map((line) => normalizeSpaces(line))
    .filter(Boolean);

  /*
   * ==========================================================
   * ESTRATEGIA 1
   *
   * La carrera normalmente está inmediatamente después
   * de "Escuela de ..." y antes de:
   *
   * - Plan de estudios
   * - Código de carrera (70201 - ARQ)
   * - encabezado de tabla
   * ==========================================================
   */

  const schoolIndex = lines.findIndex((line) => /^Escuela\b/i.test(line));

  if (schoolIndex >= 0) {
    const candidates: string[] = [];

    for (
      let index = schoolIndex + 1;
      index < Math.min(lines.length, schoolIndex + 8);
      index += 1
    ) {
      const candidate = lines[index];

      /*
       * Llegamos a la siguiente sección:
       * dejamos de buscar.
       */
      if (
        /^Plan\s+de\s+estudios/i.test(candidate) ||
        isCareerCodeLine(candidate) ||
        isTableHeader(candidate)
      ) {
        break;
      }

      if (isMetadataLine(candidate)) {
        continue;
      }

      candidates.push(candidate);
    }

    if (candidates.length) {
      /*
       * En la estructura oficial que estamos manejando,
       * la carrera es la primera línea útil después de Escuela.
       */
      return candidates[0];
    }
  }

  /*
   * ==========================================================
   * ESTRATEGIA 2
   *
   * Buscar hacia atrás desde "Plan de estudios".
   *
   * Esto cubre PDFs donde "Escuela" no fue extraída
   * correctamente pero sí tenemos:
   *
   * Carrera
   * Plan de estudios: XXXXX
   * ==========================================================
   */

  const planIndex = lines.findIndex((line) =>
    /^Plan\s+de\s+estudios/i.test(line),
  );

  if (planIndex > 0) {
    for (
      let index = planIndex - 1;
      index >= Math.max(0, planIndex - 6);
      index -= 1
    ) {
      const candidate = lines[index];

      if (
        isMetadataLine(candidate) ||
        /^Escuela\b/i.test(candidate) ||
        /^Facultad\b/i.test(candidate) ||
        /^Universidad\b/i.test(candidate)
      ) {
        continue;
      }

      return candidate;
    }
  }

  /*
   * ==========================================================
   * ESTRATEGIA 3
   *
   * Buscar antes del código:
   *
   * Arquitectura
   * 70201 - ARQ
   *
   * o:
   *
   * Licenciatura en Informática
   * 40601 - INFO
   * ==========================================================
   */

  const careerCodeIndex = lines.findIndex(isCareerCodeLine);

  if (careerCodeIndex > 0) {
    for (
      let index = careerCodeIndex - 1;
      index >= Math.max(0, careerCodeIndex - 6);
      index -= 1
    ) {
      const candidate = lines[index];

      if (
        /^Plan\s+de\s+estudios/i.test(candidate) ||
        isMetadataLine(candidate) ||
        /^Escuela\b/i.test(candidate) ||
        /^Facultad\b/i.test(candidate) ||
        /^Universidad\b/i.test(candidate)
      ) {
        continue;
      }

      return candidate;
    }
  }

  /*
   * ==========================================================
   * ESTRATEGIA 4 - FALLBACK
   *
   * Casos con títulos académicos conocidos.
   *
   * No dependemos de esto normalmente, pero sirve para
   * documentos con estructura alterada.
   * ==========================================================
   */

  const explicit = lines.find((line) =>
    /^(Licenciatura|Ingeniería|Ingenieria|Doctorado|Maestría|Maestria|Especialidad|Técnico|Tecnico|Tecnólogo|Tecnologo|Profesorado)\b/i.test(
      line,
    ),
  );

  return explicit ?? null;
}

function isCareerCodeLine(value: string): boolean {
  return /^\d{3,10}\s*-\s*[A-ZÁÉÍÓÚÑ0-9_-]{2,20}$/i.test(value.trim());
}

function isTableHeader(value: string): boolean {
  const normalized = removeDiacritics(value)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  return (
    normalized.includes('clave') &&
    normalized.includes('asignatura') &&
    normalized.includes('ht') &&
    normalized.includes('hp') &&
    normalized.includes('cr')
  );
}

function isMetadataLine(value: string): boolean {
  const normalized = normalizeSpaces(value);

  return (
    /^Universidad Autónoma/i.test(normalized) ||
    /^Facultad\b/i.test(normalized) ||
    /^Escuela\b/i.test(normalized) ||
    /^Plan\s+de\s+estudios/i.test(normalized) ||
    isCareerCodeLine(normalized) ||
    isTableHeader(normalized) ||
    /^Resumen$/i.test(normalized) ||
    /^Leyenda$/i.test(normalized) ||
    /^Total\s+HT/i.test(normalized) ||
    /^Total\s+HP/i.test(normalized) ||
    /^Total\s+Creditos/i.test(normalized) ||
    /^https?:\/\//i.test(normalized) ||
    /Planes de Estudios de la Universidad Autónoma/i.test(normalized) ||
    /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(normalized)
  );
}

/* ============================================================
 * TABLE PARSING
 * ============================================================ */

function parsePages(pages: PositionedLine[][]): ParsedStudyPlanSubject[] {
  const subjects: ParsedStudyPlanSubject[] = [];

  let semester: number | null = null;
  let optionalSection = false;
  let thesisSection = false;
  let order = 0;

  for (const lines of pages) {
    const columns = detectColumns(lines);

    if (!columns) {
      continue;
    }

    let current: ParsedStudyPlanSubject | null = null;
    let pendingCodePrefix: string | null = null;

    for (const line of lines) {
      const fullText = line.items
        .map((item) => item.text)
        .join(' ')
        .trim();

      if (!fullText) {
        continue;
      }

      if (isIgnoredLine(fullText)) {
        continue;
      }

      if (/Asignaturas\s+Optativas/i.test(fullText)) {
        pushCurrent();

        optionalSection = true;
        thesisSection = false;
        semester =
          parseSemester(
            fullText
              .replace(/^.*?Asignaturas\s+Optativas\s*-?\s*/i, '')
              .replace(/\s*\(continuaci[oó]n\)\s*$/i, ''),
          ) ?? semester;
        pendingCodePrefix = null;

        continue;
      }

      if (/^Tesis\s+de\s+Grado$/i.test(fullText)) {
        pushCurrent();

        thesisSection = true;
        optionalSection = false;
        semester = null;
        pendingCodePrefix = null;

        continue;
      }

      const semesterValue = parseSemester(fullText);

      if (semesterValue !== null) {
        pushCurrent();

        semester = semesterValue;
        thesisSection = false;
        pendingCodePrefix = null;

        continue;
      }

      const cells = splitLineIntoCells(line, columns);

      if (
        !cells.code &&
        !cells.subject &&
        isNumeric(cells.ht) &&
        isNumeric(cells.hp) &&
        isNumeric(cells.credits)
      ) {
        pushCurrent();
        pendingCodePrefix = null;
        continue;
      }

      const rawCode = cleanSubjectCodeCell(cells.code);
      const completeCode = normalizeSubjectCode(rawCode);

      if (completeCode) {
        pushCurrent();
        pendingCodePrefix = null;

        current = createSubjectFromCells(
          completeCode,
          cells,
          semester,
          optionalSection,
          thesisSection,
          ++order,
        );

        continue;
      }

      if (isCodePrefix(rawCode)) {
        pushCurrent();

        pendingCodePrefix = normalizeCodePrefix(rawCode);

        if (
          cells.subject ||
          cells.ht ||
          cells.hp ||
          cells.credits ||
          cells.prerequisites ||
          cells.equivalences
        ) {
          current = createSubjectFromCells(
            pendingCodePrefix,
            cells,
            semester,
            optionalSection,
            thesisSection,
            ++order,
          );
        }

        continue;
      }

      if (pendingCodePrefix && isCodeSuffix(rawCode)) {
        const combinedCode = normalizeSubjectCode(
          `${pendingCodePrefix}${rawCode}`,
        );

        if (combinedCode) {
          if (current) {
            current.code = combinedCode;
            mergeCellsIntoSubject(current, cells);
          } else {
            current = createSubjectFromCells(
              combinedCode,
              cells,
              semester,
              optionalSection,
              thesisSection,
              ++order,
            );
          }
        }

        pendingCodePrefix = null;
        continue;
      }

      if (current) {
        mergeCellsIntoSubject(current, cells);
      }
    }

    pushCurrent();

    function pushCurrent(): void {
      if (!current) {
        return;
      }

      current.name = normalizeSpaces(current.name);
      current.prerequisiteText = nullable(
        normalizeSpaces(current.prerequisiteText ?? ''),
      );
      current.equivalenceText = nullable(
        normalizeSpaces(current.equivalenceText ?? ''),
      );

      const validCode = normalizeSubjectCode(current.code);

      if (validCode && current.name && current.credits >= 0) {
        current.code = validCode;
        subjects.push(current);
      }

      current = null;
    }
  }

  return deduplicateSubjects(subjects);
}

function createSubjectFromCells(
  code: string,
  cells: RowCells,
  semester: number | null,
  optionalSection: boolean,
  thesisSection: boolean,
  order: number,
): ParsedStudyPlanSubject {
  const numeric = readNumericCells(cells);

  return {
    code,
    name: cells.subject.trim(),
    theoreticalHours: numeric.ht,
    practicalHours: numeric.hp,
    credits: numeric.credits,
    semester,
    prerequisiteText: nullable(cells.prerequisites),
    equivalenceText: nullable(cells.equivalences),
    mandatory: !optionalSection,
    type: thesisSection ? 'TESIS' : optionalSection ? 'OPTATIVA' : 'REGULAR',
    order,
  };
}

function mergeCellsIntoSubject(
  subject: ParsedStudyPlanSubject,
  cells: RowCells,
): void {
  if (cells.subject) {
    subject.name = appendText(subject.name, cells.subject);
  }

  if (cells.prerequisites) {
    subject.prerequisiteText = appendNullable(
      subject.prerequisiteText,
      cells.prerequisites,
    );
  }

  if (cells.equivalences) {
    subject.equivalenceText = appendNullable(
      subject.equivalenceText,
      cells.equivalences,
    );
  }

  const numeric = readNumericCells(cells);

  if (isNumeric(cells.ht)) {
    subject.theoreticalHours = numeric.ht;
  }

  if (isNumeric(cells.hp)) {
    subject.practicalHours = numeric.hp;
  }

  if (isNumeric(cells.credits)) {
    subject.credits = numeric.credits;
  }
}

function cleanSubjectCodeCell(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\uFFFE\uFFFF\u00AD]/g, '')
    .replace(/\s+/g, '')
    .toUpperCase();
}

function isCodePrefix(value: string): boolean {
  const clean = cleanSubjectCodeCell(value);
  return /^[A-Z]{2,5}-?$/.test(clean);
}

function normalizeCodePrefix(value: string): string {
  return cleanSubjectCodeCell(value).replace(/-$/, '');
}

function isCodeSuffix(value: string): boolean {
  const clean = cleanSubjectCodeCell(value);
  return /^[A-Z0-9]{3,5}$/.test(clean);
}

/* ============================================================
 * COLUMN DETECTION
 * ============================================================ */

function detectColumns(lines: PositionedLine[]): TableColumns | null {
  for (const line of lines) {
    const normalized = line.items.map((item) => ({
      ...item,
      key: normalizeHeader(item.text),
    }));

    const code = normalized.find((item) => item.key === 'clave');

    const subject = normalized.find((item) => item.key === 'asignatura');

    const ht = normalized.find((item) => item.key === 'ht');

    const hp = normalized.find((item) => item.key === 'hp');

    const credits = normalized.find((item) => item.key === 'cr');

    const prerequisites = normalized.find((item) =>
      item.key.startsWith('prerequis'),
    );

    const equivalences = normalized.find((item) =>
      item.key.startsWith('equivalenc'),
    );

    if (
      code &&
      subject &&
      ht &&
      hp &&
      credits &&
      prerequisites &&
      equivalences
    ) {
      return {
        code: code.x,
        subject: subject.x,
        ht: ht.x,
        hp: hp.x,
        credits: credits.x,
        prerequisites: prerequisites.x,
        equivalences: equivalences.x,
      };
    }
  }

  return null;
}

interface RowCells {
  code: string;
  subject: string;
  ht: string;
  hp: string;
  credits: string;
  prerequisites: string;
  equivalences: string;
}

function splitLineIntoCells(
  line: PositionedLine,
  columns: TableColumns,
): RowCells {
  const cells: RowCells = {
    code: '',
    subject: '',
    ht: '',
    hp: '',
    credits: '',
    prerequisites: '',
    equivalences: '',
  };

  const boundaries = {
    subject: midpoint(columns.code, columns.subject),

    ht: midpoint(columns.subject, columns.ht),

    hp: midpoint(columns.ht, columns.hp),

    credits: midpoint(columns.hp, columns.credits),

    prerequisites: midpoint(columns.credits, columns.prerequisites),

    equivalences: midpoint(columns.prerequisites, columns.equivalences),
  };

  for (const item of line.items) {
    const x = item.x;

    if (x < boundaries.subject) {
      cells.code = appendText(cells.code, item.text);
    } else if (x < boundaries.ht) {
      cells.subject = appendText(cells.subject, item.text);
    } else if (x < boundaries.hp) {
      cells.ht = appendText(cells.ht, item.text);
    } else if (x < boundaries.credits) {
      cells.hp = appendText(cells.hp, item.text);
    } else if (x < boundaries.prerequisites) {
      cells.credits = appendText(cells.credits, item.text);
    } else if (x < boundaries.equivalences) {
      cells.prerequisites = appendText(cells.prerequisites, item.text);
    } else {
      cells.equivalences = appendText(cells.equivalences, item.text);
    }
  }

  return cells;
}

/* ============================================================
 * POSITIONING
 * ============================================================ */

function groupIntoLines(items: PositionedItem[]): PositionedLine[] {
  const sorted = [...items].sort((a, b) => {
    if (Math.abs(a.y - b.y) > 2) {
      return b.y - a.y;
    }

    return a.x - b.x;
  });

  const lines: PositionedLine[] = [];

  const tolerance = 3;

  for (const item of sorted) {
    let line = lines.find(
      (candidate) => Math.abs(candidate.y - item.y) <= tolerance,
    );

    if (!line) {
      line = {
        y: item.y,
        items: [],
      };

      lines.push(line);
    }

    line.items.push(item);
  }

  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
  }

  return lines.sort((a, b) => b.y - a.y);
}

/* ============================================================
 * SUBJECT CODE
 * ============================================================ */

function normalizeSubjectCode(value: string): string | null {
  if (!value) {
    return null;
  }

  const clean = value
    .normalize('NFKD')
    .replace(/[\uFFFE\uFFFF\u00AD]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();

  const match = clean.match(/^([A-Z]{2,5})([A-Z0-9]{4})$/);

  if (!match) {
    return null;
  }

  return `${match[1]}${match[2]}`;
}

/* ============================================================
 * SEMESTERS
 * ============================================================ */

function parseSemester(value: string): number | null {
  const normalized = removeDiacritics(value).toLowerCase().trim();

  const values: Record<string, number> = {
    primer: 1,
    primero: 1,
    segundo: 2,
    tercer: 3,
    tercero: 3,
    cuarto: 4,
    quinto: 5,
    sexto: 6,
    septimo: 7,
    octavo: 8,
    noveno: 9,
    decimo: 10,
    undecimo: 11,
    duodecimo: 12,
  };

  const match = normalized.match(
    /^(primer|primero|segundo|tercer|tercero|cuarto|quinto|sexto|septimo|octavo|noveno|decimo|undecimo|duodecimo)\s+semestre$/,
  );

  if (!match) {
    return null;
  }

  return values[match[1]] ?? null;
}

/* ============================================================
 * UTILS
 * ============================================================ */

function readNumericCells(cells: RowCells): {
  ht: number;
  hp: number;
  credits: number;
} {
  return {
    ht: safeNumber(cells.ht),
    hp: safeNumber(cells.hp),
    credits: safeNumber(cells.credits),
  };
}

function safeNumber(value: string): number {
  const match = value.match(/\d+(?:[.,]\d+)?/);

  if (!match) {
    return 0;
  }

  return Number(match[0].replace(',', '.'));
}

function isNumeric(value: string): boolean {
  return /^\s*\d+(?:[.,]\d+)?\s*$/.test(value);
}

function midpoint(a: number, b: number): number {
  return a + (b - a) / 2;
}

function appendText(previous: string, next: string): string {
  const value = cleanText(next);

  if (!value) {
    return previous;
  }

  if (!previous) {
    return value;
  }

  return `${previous} ${value}`;
}

function appendNullable(previous: string | null, next: string): string | null {
  return nullable(appendText(previous ?? '', next));
}

function nullable(value: string): string | null {
  const clean = normalizeSpaces(value);

  return clean || null;
}

function cleanText(value: string): string {
  return value
    .replace(/[\uFFFE\uFFFF\u00AD]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSpaces(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,\s*/g, ', ')
    .replace(/\s*\/\s*/g, ' / ')
    .trim();
}

function removeDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function normalizeHeader(value: string): string {
  return removeDiacritics(cleanText(value))
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function matchFirst(text: string, expression: RegExp): string | null {
  return text.match(expression)?.[1] ?? null;
}

function numberMatch(text: string, expression: RegExp): number | null {
  const value = matchFirst(text, expression);

  return value ? Number(value) : null;
}

function isIgnoredLine(value: string): boolean {
  return (
    /^Clave\s+Asignatura/i.test(value) ||
    /^Universidad Autónoma/i.test(value) ||
    /^Sitio Oficial/i.test(value) ||
    /^Alma Máter/i.test(value) ||
    /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(value) ||
    /Planes de Estudios de la Universidad Autónoma/i.test(value) ||
    /^https?:\/\//i.test(value) ||
    /^\d+\/\d+$/.test(value) ||
    /^Resumen$/i.test(value) ||
    /^Total HT:/i.test(value) ||
    /^Total HP:/i.test(value) ||
    /^Total Creditos:/i.test(value) ||
    /^Leyenda$/i.test(value) ||
    /^HT\s*:\s*Horas/i.test(value) ||
    /^La barra/i.test(value) ||
    /^entre paréntesis/i.test(value)
  );
}

function deduplicateSubjects(
  subjects: ParsedStudyPlanSubject[],
): ParsedStudyPlanSubject[] {
  const map = new Map<string, ParsedStudyPlanSubject>();

  for (const subject of subjects) {
    /*
     * Una materia puede aparecer como
     * asignatura normal y también en
     * catálogo optativo. En ese caso
     * necesitamos distinguirla por
     * sección/semestre.
     */
    const key = `${subject.type}:${subject.semester ?? 0}:${subject.code}`;

    if (!map.has(key)) {
      map.set(key, subject);
    }
  }

  return [...map.values()];
}
