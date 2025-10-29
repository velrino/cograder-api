import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable } from '@nestjs/common';
import { FirebaseDatabaseService } from 'src/shared/google/firebase/database/database.service';
import { FirebaseStorageService } from 'src/shared/google/firebase/storage/storage.service';
import { FirebaseDatabasePath } from 'src/shared/google/firebase/database/database.enum';
import { Log, LogAction, LogType } from 'src/shared/log/log.helper';
import * as sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { IImageProcessingJob } from 'src/modules/queue/queue.service';
import { QueuesEnum } from 'src/modules/queue/queue.interface';
import { JobStatus } from 'src/modules/jobs/job.interface';

@Injectable()
@Processor(QueuesEnum.IMAGE_PROCESSING)
export class ImageProcessingService {
  constructor(
    private readonly firebaseDatabase: FirebaseDatabaseService,
    private readonly firebaseStorage: FirebaseStorageService,
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
        { jobId, imageUrl, message: 'Starting image processing' },
      );

      // Update status: Processing
      await this.updateJobStatus(jobId, JobStatus.active, 10);

      // Step 1: Download image
      const imageBuffer = await this.downloadImage(imageUrl);
      await this.updateJobStatus(jobId, JobStatus.active, 30);

      // Step 2: Validate image
      await this.validateImage(imageBuffer);
      await this.updateJobStatus(jobId, JobStatus.active, 40);

      // Step 3: Transform image (resize, grayscale, watermark)
      const transformedBuffer = await this.transformImage(imageBuffer);
      await this.updateJobStatus(jobId, JobStatus.active, 70);

      // Step 4: Upload to Firebase Storage
      const resultUrl = await this.uploadToStorage(jobId, transformedBuffer);
      await this.updateJobStatus(jobId, JobStatus.active, 90);

      // Step 5: Mark as completed
      await this.updateJobStatus(jobId, JobStatus.completed, 100, resultUrl);

      Log(
        LogType.INFO,
        ImageProcessingService.name,
        this.processImage.name,
        LogAction.SUCCESS,
        { jobId, resultUrl, message: 'Image processing completed' },
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 30 seconds timeout

    try {
      const response = await fetch(imageUrl, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Image not found (404)');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Check size limit (10MB)
      const sizeInMB = buffer.length / (1024 * 1024);
      if (sizeInMB > 10) {
        throw new Error(`Image too large: ${sizeInMB.toFixed(2)}MB (max 10MB)`);
      }

      return buffer;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error('Image download timeout');
      }
      if (error.message.includes('fetch failed')) {
        throw new Error('Failed to fetch image - network error');
      }
      throw new Error(`Failed to download image: ${error.message}`);
    }
  }

  private async validateImage(imageBuffer: Buffer): Promise<void> {
    try {
      const metadata = await sharp(imageBuffer).metadata();

      // Check if it's a valid image format
      const validFormats = ['jpeg', 'jpg', 'png', 'webp'];
      if (!validFormats.includes(metadata.format)) {
        throw new Error(
          `Invalid image format: ${metadata.format}. Supported: ${validFormats.join(', ')}`,
        );
      }

      // Check image size (double-check after download)
      const sizeInMB = imageBuffer.length / (1024 * 1024);
      if (sizeInMB > 10) {
        throw new Error(`Image too large: ${sizeInMB.toFixed(2)}MB (max 10MB)`);
      }
    } catch (error) {
      if (error.message.includes('Input buffer')) {
        throw new Error('Invalid image file');
      }
      throw error;
    }
  }

  private async transformImage(imageBuffer: Buffer): Promise<Buffer> {
    try {
      // First, resize and convert to grayscale
      const resizedImage = sharp(imageBuffer)
        .resize(800, 600, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .grayscale();

      // Get the actual dimensions after resize
      const metadata = await resizedImage.metadata();
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
      const transformedImage = await resizedImage
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
      throw new Error(`Image transformation failed: ${error.message}`);
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
          message: 'Firebase Storage upload completed',
          storagePath,
          size: imageBuffer.length,
          publicUrl,
        },
      );

      return publicUrl;
    } catch (error) {
      throw new Error(`Failed to upload to storage: ${error.message}`);
    }
  }

  private async updateJobStatus(
    jobId: string,
    status: JobStatus,
    progress: number,
    resultUrl?: string,
    error?: string,
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        progress,
        updatedAt: new Date(),
      };

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
