import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { FirebaseDatabaseService } from 'src/shared/google/firebase/database/database.service';
import { FirebaseStorageService } from 'src/shared/google/firebase/storage/storage.service';
import { FirebaseDatabasePath } from 'src/shared/google/firebase/database/database.enum';
import { Log, LogAction, LogType } from 'src/shared/log/log.helper';
import * as sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { JobStatus } from 'src/modules/jobs/job.interface';
import {
  ImageProcessingMessage,
  ImageProcessingError,
} from 'src/shared/constants/messages.enum';
import { ImageValidatorService } from '../validator/validator.service';
import { QueuesEnum } from 'src/shared/queue/queue.interface';
import { IImageProcessingJob } from 'src/shared/queue/queue.service';

@Injectable()
@Processor(QueuesEnum.IMAGE_PROCESSING)
export class ImageProcessingService {
  constructor(
    private readonly firebaseDatabase: FirebaseDatabaseService,
    private readonly firebaseStorage: FirebaseStorageService,
    private readonly imageValidator: ImageValidatorService,
  ) {}

  @Process()
  async processImage(job: Job<IImageProcessingJob>): Promise<void> {
    const { jobId, imageUrl } = job.data;

    try {
      Log(
        LogType.INFO,
        ImageProcessingService.name,
        this.processImage.name,
        LogAction.SUCCESS,
        { jobId, imageUrl, message: ImageProcessingMessage.STARTING },
      );

      // Update status: Processing with original URL
      await this.updateJobStatus(jobId, JobStatus.active, 10, undefined, undefined, imageUrl);
      await job.progress(10);

      // Step 1: Download image
      const imageBuffer = await this.downloadImage(imageUrl);
      await this.updateJobStatus(jobId, JobStatus.active, 30, undefined, undefined, imageUrl);
      await job.progress(30);

      // Step 2: Validate image
      await this.validateImage(imageBuffer);
      await this.updateJobStatus(jobId, JobStatus.active, 40, undefined, undefined, imageUrl);
      await job.progress(30);

      // Step 3: Transform image (resize, grayscale, watermark)
      const transformedBuffer = await this.transformImage(imageBuffer);
      await this.updateJobStatus(jobId, JobStatus.active, 70, undefined, undefined, imageUrl);
      await job.progress(70);

      // Step 4: Upload to Firebase Storage
      const resultUrl = await this.uploadToStorage(jobId, transformedBuffer);
      await this.updateJobStatus(jobId, JobStatus.active, 90, resultUrl, undefined, imageUrl);
      await job.progress(90);

      // Step 5: Mark as completed
      await this.updateJobStatus(jobId, JobStatus.completed, 100, resultUrl, undefined, imageUrl);
      await job.progress(100);

      Log(
        LogType.INFO,
        ImageProcessingService.name,
        this.processImage.name,
        LogAction.SUCCESS,
        { jobId, resultUrl, message: ImageProcessingMessage.COMPLETED },
      );
    } catch (error) {
      Log(
        LogType.ERROR,
        ImageProcessingService.name,
        this.processImage.name,
        LogAction.FAILED,
        { jobId, error },
      );

      await this.updateJobStatus(
        jobId,
        JobStatus.failed,
        0,
        undefined,
        error.message,
      );

      throw error;
    }
  }

  private async downloadImage(imageUrl: string): Promise<Buffer> {
    try {
      const result = await this.imageValidator.validate(imageUrl, {
        checkContent: true,
        timeout: 10000,
        maxSizeInMB: 10,
      });

      if (!result.buffer) {
        throw new Error(ImageProcessingError.DOWNLOAD_FAILED);
      }

      return result.buffer;
    } catch (error) {
      // Re-throw as Error for consistency with existing error handling
      if (error.response?.message) {
        throw new Error(error.response.message);
      }
      throw new Error(ImageProcessingError.DOWNLOAD_FAILED);
    }
  }

  private async validateImage(imageBuffer: Buffer): Promise<void> {
    try {
      const metadata = await sharp(imageBuffer).metadata();

      // Check if it's a valid image format
      const validFormats = ['jpeg', 'jpg', 'png', 'webp'];
      if (!validFormats.includes(metadata.format)) {
        throw new Error(ImageProcessingError.INVALID_FORMAT);
      }

      // Check image size (double-check after download)
      const sizeInMB = imageBuffer.length / (1024 * 1024);
      if (sizeInMB > 10) {
        throw new Error(ImageProcessingError.TOO_LARGE);
      }
    } catch (error) {
      if (error.message.includes('Input buffer')) {
        throw new Error(ImageProcessingError.INVALID_FILE);
      }
      throw error;
    }
  }

  private async transformImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      // First, resize and convert to grayscale
      const resizedBuffer = await sharp(imageBuffer)
        .resize(800, 600, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .grayscale()
        .toBuffer();

      // Get the actual dimensions after resize
      const metadata = await sharp(resizedBuffer).metadata();
      const width = metadata.width || 800;
      const height = metadata.height || 600;

      // Create watermark SVG with correct dimensions
      const watermarkSvg = Buffer.from(
        `<svg width="${width}" height="${height}">
          <text x="50%" y="95%" font-size="20" fill="rgba(255,255,255,0.5)" text-anchor="middle">
            Processed by CoGrader
          </text>
        </svg>`,
      );

      // Apply watermark with composite
      const transformedImage = await sharp(resizedBuffer)
        .composite([
          {
            input: watermarkSvg,
            gravity: 'southeast',
          },
        ])
        .png()
        .toBuffer();

      return transformedImage;
    } catch (error) {
      throw new Error(ImageProcessingError.TRANSFORMATION_FAILED);
    }
  }

  private async uploadToStorage(
    jobId: string,
    imageBuffer: Buffer,
  ): Promise<string> {
    try {
      const filename = `processed-${jobId}-${randomUUID()}.png`;
      const storagePath = `images/${filename}`;

      // Upload to Firebase Storage
      const publicUrl = await this.firebaseStorage.uploadFile(
        imageBuffer,
        storagePath,
        {
          contentType: 'image/png',
          metadata: {
            jobId,
            processedAt: new Date().toISOString(),
          },
        },
      );

      Log(
        LogType.INFO,
        ImageProcessingService.name,
        this.uploadToStorage.name,
        LogAction.SUCCESS,
        {
          message: ImageProcessingMessage.UPLOAD_COMPLETED,
          storagePath,
          size: imageBuffer.length,
          publicUrl,
        },
      );

      return publicUrl;
    } catch (error) {
      throw new Error(ImageProcessingError.UPLOAD_FAILED);
    }
  }

  private async updateJobStatus(
    jobId: string,
    status: JobStatus,
    progress: number,
    resultUrl?: string,
    error?: string,
    originalUrl?: string,
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        progress,
        updatedAt: new Date(),
      };

      if (originalUrl) {
        updateData.originalUrl = originalUrl;
      }

      if (resultUrl) {
        updateData.resultUrl = resultUrl;
      }

      if (error) {
        updateData.error = error;
      }

      await this.firebaseDatabase.save(
        FirebaseDatabasePath.IMAGES,
        jobId,
        updateData,
      );
    } catch (error) {
      Log(
        LogType.ERROR,
        ImageProcessingService.name,
        this.updateJobStatus.name,
        LogAction.FAILED,
        { jobId, status, error },
      );
    }
  }
}
