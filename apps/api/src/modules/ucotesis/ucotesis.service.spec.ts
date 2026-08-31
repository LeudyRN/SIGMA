import { nextSequentialCode } from './ucotesis.service';

jest.mock('../../prisma/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('UcotesisService code generation', () => {
  it('increments the numeric suffix while preserving prefix and width', () => {
    expect(nextSequentialCode('E0001', 'PER')).toBe('E0002');
    expect(nextSequentialCode('OFE-0099', 'OFE')).toBe('OFE-0100');
  });

  it('starts a sequence when no previous compatible code exists', () => {
    expect(nextSequentialCode(undefined, 'A')).toBe('A0001');
    expect(nextSequentialCode('AREA', 'A')).toBe('A0001');
  });
});
