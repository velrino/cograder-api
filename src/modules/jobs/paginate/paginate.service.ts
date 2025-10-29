import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue, Job } from 'bull';
import { PaginateJobsDto, PaginateJobsResponseDto } from './paginate.dto';
import { Log, LogAction, LogType } from 'src/shared/log/log.helper';
import { QueuesEnum } from 'src/modules/queue/queue.interface';
import {
  IImageProcessingJob,
  QueueService,
} from 'src/modules/queue/queue.service';

@Injectable()
export class PaginateJobsService {
  constructor(private queueService: QueueService) {}

  async execute(query: PaginateJobsDto): Promise<PaginateJobsResponseDto> {
    try {
      const { limit = 20, page = 1, order = 'desc' } = query;

      const { imageProcessingQueue } = this.queueService;

      // Get all jobs from BullMQ (completed, waiting, active, failed, delayed)
      const [completed, waiting, active, failed, delayed] = await Promise.all([
        imageProcessingQueue.getCompleted(),
        imageProcessingQueue.getWaiting(),
        imageProcessingQueue.getActive(),
        imageProcessingQueue.getFailed(),
        imageProcessingQueue.getDelayed(),
      ]);

      // Combine all jobs
      const allJobs: Job<IImageProcessingJob>[] = [
        ...completed,
        ...waiting,
        ...active,
        ...failed,
        ...delayed,
      ];

      if (allJobs.length === 0) {
        return {
          records: [],
          total: 0,
          page,
          limit,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false,
        };
      }

      // Convert to response format with timestamps
      const jobsArray = await Promise.all(
        allJobs.map(async (job) => ({
          id: job.data.jobId,
          imageUrl: job.data.imageUrl,
          status: await job.getState(),
          progress: job.progress(),
          createdAt: job.timestamp,
          failedReason: job.failedReason,
          returnvalue: job.returnvalue,
        })),
      );

      // Sort by orderBy field
      jobsArray.sort((a, b) => {
        const aValue = a.createdAt || 0;
        const bValue = b.createdAt || 0;

        if (order === 'asc') {
          return aValue - bValue;
        }
        return bValue - aValue;
      });

      // Calculate pagination
      const total = jobsArray.length;
      const totalPages = Math.ceil(total / limit);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;

      // Slice data for current page
      const paginatedData = jobsArray.slice(startIndex, endIndex);

      Log(
        LogType.INFO,
        PaginateJobsService.name,
        this.execute.name,
        LogAction.SUCCESS,
        { total, page, limit, order },
      );

      return {
        records: paginatedData,
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      };
    } catch (error) {
      Log(
        LogType.ERROR,
        PaginateJobsService.name,
        this.execute.name,
        LogAction.FAILED,
        { error, query },
      );
      throw error;
    }
  }
}
