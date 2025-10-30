import { Injectable } from '@nestjs/common';
import { QueuesEnum } from './queue.interface';
import { InjectQueue } from '@nestjs/bull';
import Bull, { Queue, Job } from 'bull';
import { Log, LogAction, LogType } from 'src/shared/log/log.helper';

export interface IImageProcessingJob {
  imageUrl: string;
  jobId: string;
}

@Injectable()
export class QueueService {
  constructor(
    @InjectQueue(QueuesEnum.IMAGE_PROCESSING)
    public imageProcessingQueue: Queue<IImageProcessingJob>,
  ) {}

  private readonly defaultQueueOptions: Bull.JobOptions = {
    // Automatically remove the job from the queue upon successful completion
    removeOnComplete: true,
    // Automatically remove the job from the queue upon failure
    removeOnFail: true,
    // Set the number of retry attempts in case of failure
    attempts: 2,
    // Define a fixed delay of 1 minute (60,000 milliseconds) between retry attempts
    backoff: {
      type: 'fixed',
      delay: 60000, // 1 minute in milliseconds
    },
  };

  async addImageProcessingJob(
    jobData: IImageProcessingJob,
  ): Promise<Job<IImageProcessingJob>> {
    try {
      const job = await this.imageProcessingQueue.add(
        jobData,
        this.defaultQueueOptions,
      );

      Log(
        LogType.INFO,
        QueueService.name,
        this.addImageProcessingJob.name,
        LogAction.SUCCESS,
        { jobId: job.id, imageUrl: jobData.imageUrl },
      );

      return job;
    } catch (error) {
      Log(
        LogType.ERROR,
        QueueService.name,
        this.addImageProcessingJob.name,
        LogAction.FAILED,
        { error, jobData },
      );
      throw error;
    }
  }

  async getJobStatus(jobId: string): Promise<Bull.JobStatus | 'stuck' | null> {
    try {
      const job = await this.imageProcessingQueue.getJob(jobId);
      if (!job) return null;

      const state = await job.getState();
      return state;
    } catch (error) {
      Log(
        LogType.ERROR,
        QueueService.name,
        this.getJobStatus.name,
        LogAction.FAILED,
        { error, jobId },
      );
      throw error;
    }
  }

  async getJob(jobId: string): Promise<Job<IImageProcessingJob> | null> {
    try {
      return await this.imageProcessingQueue.getJob(jobId);
    } catch (error) {
      Log(
        LogType.ERROR,
        QueueService.name,
        this.getJob.name,
        LogAction.FAILED,
        { error, jobId },
      );
      throw error;
    }
  }

  async ping(): Promise<boolean> {
    try {
      const client = this.imageProcessingQueue.client;
      const result = await client.ping();
      return result === 'PONG';
    } catch (error) {
      Log(LogType.ERROR, QueueService.name, 'ping', LogAction.FAILED, {
        error,
      });
      return false;
    }
  }
}
