import {
  Body,
  Controller,
  Post,
  Get,
  Query,
  Param,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { CreateJobService } from './create/create.service';
import { CreateJobDto } from './create/create.dto';
import { JobResponseDto } from './job.dto';
import { PaginateJobsService } from './paginate/paginate.service';
import {
  PaginateJobsDto,
  PaginateJobsResponseDto,
} from './paginate/paginate.dto';
import { GetJobService } from './get/get.service';
import { UploadImagesService } from './upload/upload.service';
import { UploadImagesResponseDto } from './upload/upload.dto';

@ApiTags('jobs')
@Controller('api/jobs')
export class JobsController {
  constructor(
    private readonly createJobService: CreateJobService,
    private readonly paginateJobsService: PaginateJobsService,
    private readonly getJobService: GetJobService,
    private readonly uploadImagesService: UploadImagesService,
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

  @Post('upload')
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload image files',
    description:
      'Upload one or more image files (max 10 files, 10MB each). Files are stored in Firebase Storage under uploads folder and return normalized metadata.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Files uploaded successfully',
    type: UploadImagesResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file type or no files provided',
  })
  @ApiResponse({
    status: 413,
    description: 'File too large (max 10MB per file)',
  })
  async uploadImages(
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<UploadImagesResponseDto> {
    return this.uploadImagesService.execute(files);
  }
}
