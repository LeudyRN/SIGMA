export function extractAcademicCodes(value: string | null): Set<string> {
  return new Set(value?.toUpperCase().match(/[A-Z]{2,5}[A-Z0-9]{4,5}/g) ?? []);
}

export function normalizeAcademicText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b\d{3,}\b/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

export function academicSubjectMatches(
  historySubject: { code: string; name: string },
  planSubject: { code: string; equivalences: string | null; name: string },
): boolean {
  return (
    historySubject.code === planSubject.code ||
    extractAcademicCodes(planSubject.equivalences).has(historySubject.code) ||
    normalizeAcademicText(historySubject.name) ===
      normalizeAcademicText(planSubject.name)
  );
}
