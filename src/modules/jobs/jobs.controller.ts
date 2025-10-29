import { Body, Controller, Post, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CreateJobService } from './create/create.service';
import { CreateJobDto } from './create/create.dto';
import { JobResponseDto } from './job.dto';
import { PaginateJobsService } from './paginate/paginate.service';
import {
  PaginateJobsDto,
  PaginateJobsResponseDto,
} from './paginate/paginate.dto';
import { GetJobService } from './get/get.service';

@ApiTags('jobs')
@Controller('api/jobs')
export class JobsController {
  constructor(
    private readonly createJobService: CreateJobService,
    private readonly paginateJobsService: PaginateJobsService,
    private readonly getJobService: GetJobService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Create new image processing job',
    description:
      'Validates image URL and creates a new job in the processing queue',
  })
  @ApiResponse({
    status: 201,
    description: 'Job created successfully',
    type: JobResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid URL, 404, non-image URL, or image too large (>10MB)',
  })
  async createJob(@Body() body: CreateJobDto): Promise<JobResponseDto> {
    return this.createJobService.execute(body);
  }

  @Get()
  @ApiOperation({
    summary: 'List all bull jobs with pagination',
    description: 'Returns paginated list of all jobs from BullMQ queue',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    enum: ['createdAt', 'updatedAt'],
    example: 'updatedAt',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @ApiResponse({
    status: 200,
    description: 'Jobs retrieved successfully',
    type: PaginateJobsResponseDto,
  })
  async listJobs(
    @Query() query: PaginateJobsDto,
  ): Promise<PaginateJobsResponseDto> {
    return this.paginateJobsService.execute(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get bull job',
    description: 'Returns the status and details of a specific job',
  })
  @ApiResponse({
    status: 200,
    description: 'Job retrieved successfully',
    type: JobResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Job not found',
  })
  async getJob(@Param('id') id: string): Promise<JobResponseDto> {
    return this.getJobService.execute(id);
  }
}
