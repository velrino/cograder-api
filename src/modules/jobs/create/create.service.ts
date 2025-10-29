import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { QueueService } from 'src/modules/queue/queue.service';
import { FirebaseDatabaseService } from 'src/shared/google/firebase/database/database.service';
import { Log, LogAction, LogType } from 'src/shared/log/log.helper';
import { CreateJobDto } from './create.dto';
import { JobResponseDto } from '../job.dto';
import { JobStatus } from '../job.interface';
import { FirebaseDatabasePath } from 'src/shared/google/firebase/database/database.enum';
import { ImageValidatorService } from '../../images/validator/validator.service';

@Injectable()
export class CreateJobService {
  constructor(
    private readonly queueService: QueueService,
    private readonly firebaseDatabase: FirebaseDatabaseService,
    private readonly imageValidator: ImageValidatorService,
  ) {}

  async execute(body: CreateJobDto): Promise<JobResponseDto> {
    try {
      await this.imageValidator.validate(body.imageUrl, {
        checkContent: false,
        timeout: 5000,
        maxSizeInMB: 10,
      });

      const jobId = randomUUID();
      const now = new Date();

      // Create initial job record in Firestore
      const jobData: JobResponseDto = {
        id: jobId,
        imageUrl: body.imageUrl,
        status: JobStatus.waiting,
        progress: 0,
        createdAt: now,
        updatedAt: now,
      };

      // Save to Firebase Realtime Database
      await this.firebaseDatabase.save(
        FirebaseDatabasePath.IMAGES,
        jobId,
        jobData,
      );

      // Add job to BullMQ queue
      await this.queueService.addImageProcessingJob({
        jobId,
        imageUrl: body.imageUrl,
      });

      Log(
        LogType.INFO,
        CreateJobService.name,
        this.execute.name,
        LogAction.SUCCESS,
        { jobId, imageUrl: body.imageUrl },
      );

      return jobData;
    } catch (error) {
      Log(
        LogType.ERROR,
        CreateJobService.name,
        this.execute.name,
        LogAction.FAILED,
        { error, body },
      );
      throw error;
    }
  }
}
