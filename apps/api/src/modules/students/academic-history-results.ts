const PASSING_STATUSES = new Set(['APROBADA', 'CONVALIDADA']);

interface AcademicAttempt {
  estado_asignatura: string;
  id_asignatura: bigint;
  periodo_codigo: string;
}

export function compareAcademicPeriods(left: string, right: string): number {
  const leftParts = periodParts(left);
  const rightParts = periodParts(right);
  if (leftParts.year !== rightParts.year)
    return leftParts.year - rightParts.year;
  if (leftParts.term !== rightParts.term)
    return leftParts.term - rightParts.term;
  return left.localeCompare(right, 'es');
}

export function selectEffectiveAcademicAttempts<T extends AcademicAttempt>(
  records: T[],
): T[] {
  const bySubject = new Map<string, T[]>();

  for (const record of records) {
    const key = record.id_asignatura.toString();
    bySubject.set(key, [...(bySubject.get(key) ?? []), record]);
  }

  return [...bySubject.values()]
    .map((attempts) => {
      const newestFirst = [...attempts].sort((left, right) =>
        compareAcademicPeriods(right.periodo_codigo, left.periodo_codigo),
      );
      return (
        newestFirst.find((attempt) =>
          PASSING_STATUSES.has(attempt.estado_asignatura),
        ) ?? newestFirst[0]
      );
    })
    .sort((left, right) =>
      compareAcademicPeriods(right.periodo_codigo, left.periodo_codigo),
    );
}

function periodParts(value: string) {
  const numbers = value.match(/\d+/g)?.map(Number) ?? [];
  return {
    term: numbers[1] ?? 0,
    year: numbers[0] ?? 0,
  };
}
