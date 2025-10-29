import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { QueueService } from 'src/modules/queue/queue.service';
import { FirebaseDatabaseService } from 'src/shared/google/firebase/firebase-database.service';
import { FirebasePathsEnum } from 'src/shared/google/firebase/firebase.enum';
import { Log, LogAction, LogType } from 'src/shared/log/log.helper';
import { CreateJobDto } from './create.dto';
import { JobResponseDto } from '../job.dto';
import { JobStatus } from '../job.interface';

@Injectable()
export class CreateJobService {
  constructor(
    private readonly queueService: QueueService,
    private readonly firebaseDatabase: FirebaseDatabaseService,
  ) {}

  async createJob(createJobDto: CreateJobDto): Promise<JobResponseDto> {
    try {
      const jobId = randomUUID();
      const now = new Date();

      // Create initial job record in Firestore
      const jobData: JobResponseDto = {
        id: jobId,
        imageUrl: createJobDto.imageUrl,
        status: JobStatus.waiting,
        progress: 0,
        createdAt: now,
        updatedAt: now,
      };

      // Save to Firebase Realtime Database
      await this.firebaseDatabase.save(
        FirebasePathsEnum.IMAGES,
        jobId,
        jobData,
      );

      // Add job to BullMQ queue
      await this.queueService.addImageProcessingJob({
        jobId,
        imageUrl: createJobDto.imageUrl,
      });

      Log(
        LogType.INFO,
        CreateJobService.name,
        this.createJob.name,
        LogAction.SUCCESS,
        { jobId, imageUrl: createJobDto.imageUrl },
      );

      return jobData;
    } catch (error) {
      Log(
        LogType.ERROR,
        CreateJobService.name,
        this.createJob.name,
        LogAction.FAILED,
        { error, createJobDto },
      );
      throw error;
    }
  }
}
