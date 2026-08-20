import { academicSubjectMatches } from './academic-history-matching';

export interface EligibilitySubject {
  code: string;
  credits: number;
  equivalences?: string | null;
  id: string;
  mandatory: boolean;
  name: string;
  order?: number | null;
  semester?: number | null;
  type: string;
}

export interface ApprovedSubject {
  code: string;
  name: string;
}

export function evaluateAcademicRequirements(
  requirements: EligibilitySubject[],
  approvedSubjects: ApprovedSubject[],
) {
  const electiveSlots = requirements.filter(isElectiveSlot);
  const regularRequirements = requirements.filter(
    (requirement) => requirement.mandatory && !isElectiveSlot(requirement),
  );
  const graduationEnrollmentRequirements =
    selectGraduationEnrollmentRequirements(regularRequirements);
  const graduationRequirementIds = new Set(
    graduationEnrollmentRequirements.map((requirement) => requirement.id),
  );
  const electiveCatalog = requirements.filter(
    (requirement) => !requirement.mandatory && requirement.type === 'OPTATIVA',
  );
  const completedRegular = regularRequirements.filter((requirement) =>
    approvedSubjects.some((subject) =>
      matchesRequirement(subject, requirement),
    ),
  );
  const pendingRegular = regularRequirements.filter(
    (requirement) =>
      !completedRegular.some((completed) => completed.id === requirement.id),
  );
  const pendingGraduationRequirements = pendingRegular.filter((requirement) =>
    graduationRequirementIds.has(requirement.id),
  );
  const pendingBlockingRequirements = pendingRegular.filter(
    (requirement) => !graduationRequirementIds.has(requirement.id),
  );

  const usedApproved = new Set<number>();
  const earnedElectiveCredits = electiveCatalog.reduce((total, elective) => {
    const approvedIndex = approvedSubjects.findIndex(
      (subject, index) =>
        !usedApproved.has(index) && matchesRequirement(subject, elective),
    );
    if (approvedIndex < 0) return total;
    usedApproved.add(approvedIndex);
    return total + elective.credits;
  }, 0);
  const requiredElectiveCredits = electiveSlots.reduce(
    (total, requirement) => total + requirement.credits,
    0,
  );
  const recognizedElectiveCredits = Math.min(
    earnedElectiveCredits,
    requiredElectiveCredits,
  );
  const pendingElectiveCredits = Math.max(
    requiredElectiveCredits - recognizedElectiveCredits,
    0,
  );
  const hasElectiveRequirement = requiredElectiveCredits > 0;
  const requiredUnits =
    regularRequirements.length + (hasElectiveRequirement ? 1 : 0);
  const completedUnits =
    completedRegular.length +
    (hasElectiveRequirement
      ? recognizedElectiveCredits / requiredElectiveCredits
      : 0);
  const completionPercentage = requiredUnits
    ? Math.round((completedUnits / requiredUnits) * 10_000) / 100
    : 0;

  return {
    completedRequirements:
      completedRegular.length +
      (hasElectiveRequirement && pendingElectiveCredits === 0 ? 1 : 0),
    completionPercentage,
    electiveCredits: {
      completed: recognizedElectiveCredits,
      earned: earnedElectiveCredits,
      pending: pendingElectiveCredits,
      required: requiredElectiveCredits,
    },
    graduationEnrollmentRequirements,
    pendingBlockingRequirements,
    pendingGraduationRequirements,
    pendingRegular,
    requiredRequirements: requiredUnits,
  };
}

export function isElectiveSlot(requirement: EligibilitySubject): boolean {
  if (!requirement.mandatory) return false;
  const normalizedName = requirement.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  return (
    normalizedName.includes('ASIGNATURA OPTATIVA') ||
    /^[A-Z]{2,5}ZZ[A-Z0-9]+$/.test(requirement.code)
  );
}

export function selectGraduationEnrollmentRequirements(
  requirements: EligibilitySubject[],
): EligibilitySubject[] {
  const candidates = requirements.filter(isGraduationRequirementCandidate);
  if (candidates.length <= 1) return candidates;

  const semesters = candidates
    .map((candidate) => candidate.semester)
    .filter(
      (semester): semester is number =>
        semester !== null && semester !== undefined,
    );
  const latestSemester = semesters.length ? Math.max(...semesters) : null;
  const latestCandidates =
    latestSemester === null
      ? candidates
      : candidates.filter((candidate) => candidate.semester === latestSemester);
  const highestStage = Math.max(
    ...latestCandidates.map((candidate) => graduationStage(candidate.name)),
  );
  if (highestStage > 0) {
    return latestCandidates.filter(
      (candidate) => graduationStage(candidate.name) === highestStage,
    );
  }

  const ordered = latestCandidates.filter(
    (candidate) => candidate.order !== null && candidate.order !== undefined,
  );
  if (!ordered.length) return latestCandidates;
  const lastOrder = Math.max(
    ...ordered.map((candidate) => candidate.order ?? 0),
  );
  return latestCandidates.filter((candidate) => candidate.order === lastOrder);
}

function isGraduationRequirementCandidate(
  requirement: EligibilitySubject,
): boolean {
  if (!requirement.mandatory) return false;
  if (requirement.type === 'TESIS') return true;
  const name = normalizeRequirementName(requirement.name);
  return [
    'TESIS',
    'MONOGRAF',
    'TRABAJO DE GRADO',
    'PROYECTO DE GRADO',
    'CURSO EQUIVAL',
  ].some((term) => name.includes(term));
}

function graduationStage(value: string): number {
  const name = normalizeRequirementName(value);
  if (/\b(?:III|3)\b/.test(name)) return 3;
  if (/\b(?:II|2)\b/.test(name)) return 2;
  if (/\b(?:I|1)\b/.test(name)) return 1;
  if (/\bFINAL\b/.test(name)) return 99;
  return 0;
}

function normalizeRequirementName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .toUpperCase()
    .trim();
}

function matchesRequirement(
  subject: ApprovedSubject,
  requirement: EligibilitySubject,
) {
  return academicSubjectMatches(subject, {
    code: requirement.code,
    equivalences: requirement.equivalences ?? null,
    name: requirement.name,
  });
}
