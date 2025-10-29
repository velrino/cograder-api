import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthCheckService } from './health-check.service';

@ApiTags('Health Check')
@Controller()
export class HealthCheckController {
  constructor(private healthCheckService: HealthCheckService) {}

  @Get()
  @ApiOperation({
    summary: 'Application health check',
    description: 'Returns Redis and Firebase connectivity status with response times'
  })
  @ApiResponse({ status: 200, description: 'Health check results with service status' })
  async healthCheck() {
    return this.healthCheckService.execute();
  }
}
