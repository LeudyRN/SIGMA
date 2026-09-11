jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));
import { projectProgress } from './coordination-policy';
import { academicPdf } from './coordination.service';
const now = new Date('2026-09-10T12:00:00Z');
const milestone = {
  id: '1',
  projectId: null,
  type: 'AVANCE',
  dueAt: '2026-09-09T12:00:00Z',
  status: 'PROGRAMADO',
};
describe('Academic progress', () => {
  it('counts latest versions, excludes other groups and cancelled activities', () => {
    const result = projectProgress(
      '7',
      [
        milestone,
        { ...milestone, id: '2', projectId: '8' },
        { ...milestone, id: '3', status: 'CANCELADO' },
      ],
      [
        {
          id: '1',
          projectId: '7',
          milestoneId: '1',
          createdAt: '2026-09-08T12:00:00Z',
          status: 'CAMBIOS',
          reviewedAt: '2026-09-08T14:00:00Z',
        },
        {
          id: '2',
          projectId: '7',
          milestoneId: '1',
          createdAt: '2026-09-09T12:00:00Z',
          status: 'APROBADO',
          reviewedAt: '2026-09-09T16:00:00Z',
        },
      ],
      now,
    );
    expect(result).toMatchObject({
      total: 1,
      approved: 1,
      percent: 100,
      overdue: 0,
      averageResponseHours: 4,
    });
  });
  it('distinguishes missing work from an advisor review backlog', () => {
    const pending = {
      id: '1',
      projectId: '7',
      milestoneId: '1',
      createdAt: '2026-09-08T12:00:00Z',
      status: 'PENDIENTE',
      reviewedAt: null,
    };
    expect(projectProgress('7', [milestone], [pending], now)).toMatchObject({
      awaitingReview: 1,
      oldestReviewDays: 2,
      overdue: 0,
    });
    expect(projectProgress('7', [milestone], [], now)).toMatchObject({
      overdue: 1,
      awaitingReview: 0,
    });
  });
  it('does not invent progress without deliverable milestones', () => {
    expect(
      projectProgress('7', [{ ...milestone, type: 'ASESORIA' }], [], now)
        .percent,
    ).toBeNull();
  });
  it('rejects spoofed PDF uploads and oversized contents', () => {
    expect(() =>
      academicPdf({
        originalname: 'fake.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('<script>bad</script>'),
        size: 20,
      }),
    ).toThrow('PDF válido');
    const buffer = Buffer.alloc(8 * 1024 * 1024 + 1);
    buffer.write('%PDF-');
    expect(() =>
      academicPdf({
        originalname: 'large.pdf',
        mimetype: 'application/pdf',
        buffer,
        size: 1,
      }),
    ).toThrow('8 MB');
  });
});
