import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from './audit.service';
import { AuditQueryDto } from './dto/audit.dto';
jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));
it('queries all pages on the server and applies an inclusive Dominican date range', async () => {
  const findMany = jest.fn().mockResolvedValue([]);
  const service = new AuditService({
    auditoria: { findMany, count: jest.fn().mockResolvedValue(241) },
  } as unknown as PrismaService);
  const result = await service.list({
    page: 6,
    pageSize: 20,
    from: '2026-09-01',
    to: '2026-09-05',
    action: 'CREAR',
    search: '100001',
  });
  expect(result.pagination).toEqual({
    page: 6,
    pageSize: 20,
    total: 241,
    pages: 13,
  });
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      skip: 100,
      take: 20,
      orderBy: [{ created_at: 'desc' }, { id_auditoria: 'desc' }],
      where: expect.objectContaining({
        accion: 'CREAR',
        created_at: {
          gte: new Date('2026-09-01T04:00:00Z'),
          lt: new Date('2026-09-06T04:00:00Z'),
        },
      }) as unknown,
    }),
  );
});
it('rejects reversed date ranges before querying', async () => {
  const service = new AuditService({} as PrismaService);
  await expect(
    service.list({ from: '2026-09-05', to: '2026-09-01' }),
  ).rejects.toBeInstanceOf(BadRequestException);
});
it('rejects invalid pagination at the HTTP boundary', async () => {
  for (const page of ['-1', '1.5', 'Infinity', 'NaN']) {
    const errors = await validate(plainToInstance(AuditQueryDto, { page }));
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  }
});
