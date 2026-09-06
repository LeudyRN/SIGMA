import { UcotesisService } from './ucotesis.service';
import { UcotesisController } from './ucotesis.controller';
import { CreateOfferDto } from './dto/ucotesis.dto';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';
import type { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { validate } from 'class-validator';
jest.mock('../../prisma/prisma.service', () => ({ PrismaService: class {} }));
it('allows offer readers through the HTTP permission guard', () => {
  expect(
    Reflect.getMetadata(
      PERMISSIONS_KEY,
      Object.getOwnPropertyDescriptor(UcotesisController.prototype, 'offers')!
        .value as object,
    ),
  ).toEqual(['UCOTESIS_OFERTAS_LEER']);
});
it('excludes unpublished offers for teachers', async () => {
  const findMany = jest.fn().mockResolvedValue([]);
  const service = new UcotesisService({
    ofertas: { findMany, findFirst: jest.fn().mockResolvedValue(null) },
  } as unknown as PrismaService);
  await service.offers({
    roles: ['DOCENTE'],
    permissions: ['UCOTESIS_OFERTAS_LEER'],
  } as AuthenticatedUser);
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { estado: 'PUBLICADA' } }),
  );
});
it('requires a supported teaching mode on new offers', async () => {
  for (const teachingMode of [undefined, 'TESIS', 'HIBRIDA']) {
    const errors = await validate(
      Object.assign(new CreateOfferDto(), { teachingMode }),
    );
    expect(errors.some((e) => e.property === 'teachingMode')).toBe(true);
  }
  for (const teachingMode of ['PRESENCIAL', 'VIRTUAL', 'SEMIPRESENCIAL']) {
    const errors = await validate(
      Object.assign(new CreateOfferDto(), { teachingMode }),
    );
    expect(errors.some((e) => e.property === 'teachingMode')).toBe(false);
  }
});
