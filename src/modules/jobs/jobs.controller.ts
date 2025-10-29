import { Body, Controller, Post } from '@nestjs/common';
import { CreateJobService } from './create/create.service';
import { CreateJobDto } from './create/create.dto';
import { JobResponseDto } from './job.dto';

@Controller('api/jobs')
export class JobsController {
  constructor(private readonly createJobService: CreateJobService) {}

  @Post()
  async createJob(@Body() body: CreateJobDto): Promise<JobResponseDto> {
    return this.createJobService.createJob(body);
  }
}
