import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

export interface HealthResponse {
  service: 'sigma-api';
  status: 'ok';
}

@ApiTags('system')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Comprueba que la API está disponible' })
  getHealth(): HealthResponse {
    return { status: 'ok', service: 'sigma-api' };
  }
}
