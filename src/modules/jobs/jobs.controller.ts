import { Body, Controller, Post, Get, Query } from '@nestjs/common';
import { CreateJobService } from './create/create.service';
import { CreateJobDto } from './create/create.dto';
import { JobResponseDto } from './job.dto';
import { PaginateJobsService } from './paginate/paginate.service';
import { PaginateJobsDto, PaginateJobsResponseDto } from './paginate/paginate.dto';

@Controller('api/jobs')
export class JobsController {
  constructor(
    private readonly createJobService: CreateJobService,
    private readonly paginateJobsService: PaginateJobsService,
  ) {}

  @Post()
  async createJob(@Body() body: CreateJobDto): Promise<JobResponseDto> {
    return this.createJobService.execute(body);
  }

  @Get()
  async listJobs(@Query() query: PaginateJobsDto): Promise<PaginateJobsResponseDto> {
    return this.paginateJobsService.execute(query);
  }
}
