import {
  Injectable,
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { FirebaseStorageService } from 'src/shared/google/firebase/storage/storage.service';
import { UploadedFileMetadataDto } from './upload.dto';
import { Log, LogAction, LogType } from 'src/shared/log/log.helper';
import { CreateJobService } from '../create/create.service';
import * as path from 'path';
import pLimit from 'p-limit';

@Injectable()
export class UploadImagesService {
  // 10MB limit
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024;

  // Allowed image MIME types
  private readonly ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ];

  constructor(
    private readonly firebaseStorageService: FirebaseStorageService,
    private readonly createJobService: CreateJobService,
  ) {}

  async execute(
    files: Express.Multer.File[],
  ): Promise<{
    files: UploadedFileMetadataDto[];
    failed?: string[];
    batchId: string;
  }> {
    const batchId = randomUUID();

    Log(
      LogType.INFO,
      UploadImagesService.name,
      this.execute.name,
      LogAction.STARTED,
      { fileCount: files.length, batchId },
    );

    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const uploadedFiles: UploadedFileMetadataDto[] = [];
    const failedFiles: string[] = [];

    // Process each file
    for (const file of files) {
      try {
        // Validate file
        this.validateFile(file);

        // Generate storage path: uploads/timestamp-originalname (sem data)
        const timestamp = Date.now();
        const sanitizedFilename = this.sanitizeFilename(file.originalname);
        const storagePath = `uploads/${timestamp}-${sanitizedFilename}`;

        // Upload to Firebase Storage
        const publicUrl = await this.firebaseStorageService.uploadFile(
          file.buffer,
          storagePath,
          {
            contentType: file.mimetype,
            metadata: {
              originalName: file.originalname,
              uploadedAt: new Date().toISOString(),
              batchId,
            },
          },
        );

        // Add to successful uploads
        uploadedFiles.push({
          name: file.originalname,
          url: publicUrl,
          size: file.size,
          mimeType: file.mimetype,
          createdAt: new Date().toISOString(),
          storagePath,
        });

        Log(
          LogType.INFO,
          UploadImagesService.name,
          this.execute.name,
          LogAction.SUCCESS,
          {
            filename: file.originalname,
            size: file.size,
            storagePath,
            batchId,
          },
        );
      } catch (error) {
        Log(
          LogType.ERROR,
          UploadImagesService.name,
          this.execute.name,
          LogAction.FAILED,
          {
            filename: file.originalname,
            error: error.message,
            batchId,
          },
        );
        failedFiles.push(file.originalname);
      }
    }

    // Create jobs for all uploaded files using Promise.allSettled for fault tolerance
    // with pLimit to control concurrency (max 5 simultaneous job creations)
    if (uploadedFiles.length > 0) {
      const limit = pLimit(5); // Limit to 5 concurrent job creations

      const jobResults = await Promise.allSettled(
        uploadedFiles.map((file) =>
          limit(() =>
            this.createJobService.execute({
              imageUrl: file.url,
              batchId, // Pass batchId to group related images
            }),
          ),
        ),
      );

      // Count successes and failures
      const successful = jobResults.filter((r) => r.status === 'fulfilled');
      const failed = jobResults.filter((r) => r.status === 'rejected');

      if (successful.length > 0) {
        Log(
          LogType.INFO,
          UploadImagesService.name,
          this.execute.name,
          LogAction.SUCCESS,
          {
            message: 'Jobs created for uploaded files',
            batchId,
            jobCount: successful.length,
          },
        );
      }

      if (failed.length > 0) {
        Log(
          LogType.ERROR,
          UploadImagesService.name,
          this.execute.name,
          LogAction.FAILED,
          {
            message: 'Some jobs failed to create',
            batchId,
            failedCount: failed.length,
            errors: failed.map((r) => (r as PromiseRejectedResult).reason?.message),
          },
        );
        // Don't throw - files were uploaded successfully, partial job creation is acceptable
      }
    }

    const response: {
      files: UploadedFileMetadataDto[];
      failed?: string[];
      batchId: string;
    } = {
      files: uploadedFiles,
      batchId,
    };

    if (failedFiles.length > 0) {
      response.failed = failedFiles;
    }

    return response;
  }

  private validateFile(file: Express.Multer.File): void {
    // Check if file exists
    if (!file || !file.buffer) {
      throw new BadRequestException('Invalid file');
    }

    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      throw new PayloadTooLargeException(
        `File ${file.originalname} exceeds maximum size of 10MB`,
      );
    }

    // Check MIME type
    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File ${file.originalname} has unsupported type. Allowed types: ${this.ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }
  }

  private sanitizeFilename(filename: string): string {
    // Remove any path traversal attempts
    const basename = path.basename(filename);

    // Replace spaces and special characters with hyphens
    return basename
      .replace(/[^a-zA-Z0-9.-]/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase();
  }
}
