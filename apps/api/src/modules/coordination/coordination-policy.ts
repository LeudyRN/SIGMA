export interface ProgressMilestone {
  id: string;
  projectId: string | null;
  type: string;
  dueAt: string;
  status: string;
}
export interface ProgressSubmission {
  id: string;
  projectId: string;
  milestoneId: string;
  createdAt: string;
  status: string;
  reviewedAt: string | null;
}
export function projectProgress(
  projectId: string,
  milestones: ProgressMilestone[],
  submissions: ProgressSubmission[],
  now = new Date(),
) {
  const required = milestones.filter(
    (m) =>
      m.status === 'PROGRAMADO' &&
      ['AVANCE', 'DEFENSA'].includes(m.type) &&
      (!m.projectId || m.projectId === projectId),
  );
  const latest = required.map((m) => ({
    milestone: m,
    submission: submissions
      .filter((s) => s.projectId === projectId && s.milestoneId === m.id)
      .sort((a, b) => Number(BigInt(b.id) - BigInt(a.id)))[0],
  }));
  const approved = latest.filter(
    (x) => x.submission?.status === 'APROBADO',
  ).length;
  const awaiting = latest.filter((x) => x.submission?.status === 'PENDIENTE');
  const reviewed = latest.filter((x) => x.submission?.reviewedAt);
  return {
    total: required.length,
    approved,
    percent: required.length
      ? Math.round((approved / required.length) * 100)
      : null,
    awaitingReview: awaiting.length,
    overdue: latest.filter(
      (x) =>
        new Date(x.milestone.dueAt) < now &&
        (!x.submission || x.submission.status === 'CAMBIOS'),
    ).length,
    changes: latest.filter((x) => x.submission?.status === 'CAMBIOS').length,
    oldestReviewDays: awaiting.length
      ? Math.max(
          ...awaiting.map((x) =>
            Math.max(
              0,
              Math.floor(
                (now.getTime() - new Date(x.submission.createdAt).getTime()) /
                  86400000,
              ),
            ),
          ),
        )
      : 0,
    averageResponseHours: reviewed.length
      ? Math.round(
          reviewed.reduce(
            (sum, x) =>
              sum +
              (new Date(x.submission.reviewedAt!).getTime() -
                new Date(x.submission.createdAt).getTime()) /
                3600000,
            0,
          ) / reviewed.length,
        )
      : null,
  };
}
