import { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';
jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));
it('returns only the actor belonging to the revoked session', async () => {
  const findFirst = jest
    .fn()
    .mockResolvedValue({ id_sesion: 3n, id_usuario: 7n });
  const updateMany = jest.fn().mockResolvedValue({ count: 1 });
  const tx = { sesiones: { findFirst, updateMany } };
  const prisma = {
    $transaction: (run: (db: typeof tx) => Promise<unknown>) => run(tx),
  } as unknown as PrismaService;
  const service = new AuthService(
    prisma,
    {} as JwtService,
    new ConfigService({ JWT_REFRESH_SECRET: 'unit-test-only' }),
  );
  await expect(service.logout('unit-test-token')).resolves.toBe('7');
  expect(findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        refresh_token_hash: expect.stringMatching(/^[a-f0-9]{64}$/) as unknown,
        revocada_at: null,
      },
    }),
  );
  findFirst.mockResolvedValue(null);
  updateMany.mockClear();
  await expect(service.logout('unknown-token')).resolves.toBeUndefined();
  expect(updateMany).not.toHaveBeenCalled();
});
