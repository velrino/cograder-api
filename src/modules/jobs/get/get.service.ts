import { Injectable, NotFoundException } from '@nestjs/common';
import { Log, LogAction, LogType } from 'src/shared/log/log.helper';
import { JobResponseDto } from '../job.dto';
import { QueueService } from 'src/shared/queue/queue.service';

@Injectable()
export class GetJobService {
  constructor(private queueService: QueueService) {}

  async execute(id: string): Promise<JobResponseDto> {
    try {
      const job = await this.queueService.getJob(id);

      if (!job) {
        throw new NotFoundException(`Job with ID ${id} not found`);
      }

      const state = await job.getState();
      const jobResponse: JobResponseDto = {
        id: job.data.jobId,
        imageUrl: job.data.imageUrl,
        status: state as any,
        progress: job.progress() as number,
        createdAt: new Date(job.timestamp),
        updatedAt: new Date(job.timestamp),
        error: job.failedReason,
        resultUrl: job.returnvalue,
      };

      Log(
        LogType.INFO,
        GetJobService.name,
        this.execute.name,
        LogAction.SUCCESS,
        { jobId: id },
      );

      return jobResponse;
    } catch (error) {
      Log(
        LogType.ERROR,
        GetJobService.name,
        this.execute.name,
        LogAction.FAILED,
        { error, jobId: id },
      );
      throw error;
    }
  }
}
