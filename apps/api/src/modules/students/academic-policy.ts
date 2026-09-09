export interface AcademicPolicy {
  maxSubjects: number;
  maxCredits: number;
  fromSemester: number;
}
export function meetsAcademicPolicy(
  pending: ReadonlyArray<{ credits: number; semester?: number | null }>,
  electiveCredits: number,
  policy: AcademicPolicy,
): boolean {
  if (electiveCredits > 0) return false;
  if (!pending.length) return true;
  return (
    pending.length <= policy.maxSubjects &&
    pending.reduce((sum, s) => sum + s.credits, 0) <= policy.maxCredits &&
    pending.every(
      (s) => s.semester != null && s.semester >= policy.fromSemester,
    )
  );
}
