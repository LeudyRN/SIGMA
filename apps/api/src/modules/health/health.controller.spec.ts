import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns the service status', async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();
    const controller = module.get(HealthController);

    expect(controller.getHealth()).toEqual({
      status: 'ok',
      service: 'sigma-api',
    });
  });
});
