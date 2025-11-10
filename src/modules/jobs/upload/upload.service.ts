import { Injectable, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { FirebaseStorageService } from 'src/shared/google/firebase/storage/storage.service';
import { UploadedFileMetadataDto } from './upload.dto';
import { Log, LogAction, LogType } from 'src/shared/log/log.helper';
import { CreateJobService } from '../create/create.service';
import * as path from 'path';
import pLimit from 'p-limit';
import { UploadMessage, UploadError } from 'src/shared/constants/messages.enum';
import { ImageValidatorService } from 'src/modules/images/validator/validator.service';

@Injectable()
export class UploadImagesService {
  constructor(
    private readonly firebaseStorageService: FirebaseStorageService,
    private readonly createJobService: CreateJobService,
    private readonly imageValidatorService: ImageValidatorService,
  ) {}

  async execute(files: Express.Multer.File[]): Promise<{
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
      {
        fileCount: files.length,
        batchId,
        message: UploadMessage.BATCH_STARTED,
      },
    );

    if (!files || files.length === 0) {
      throw new BadRequestException(UploadError.NO_FILES_PROVIDED);
    }

    const uploadedFiles: UploadedFileMetadataDto[] = [];
    const failedFiles: string[] = [];

    // Process each file
    for (const file of files) {
      try {
        // Validate file using ImageValidatorService
        this.imageValidatorService.validateUploadedFile(file, 10);

        // Generate storage path: uploads/batchId/originalname (sem data)
        const sanitizedFilename = this.sanitizeFilename(file.originalname);
        const storagePath = `uploads/${batchId}/${sanitizedFilename}`;

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
            message: UploadMessage.FILE_UPLOADED,
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
            message: UploadError.FILE_UPLOAD_FAILED,
            filename: file.originalname,
            error: error.message,
            batchId,
          },
        );
        failedFiles.push(file.originalname);
      }
    }

    // Create jobs for all uploaded files using Promise.allSettled for fault tolerance
    // with pLimit to control concurrency (max simultaneous job creations)
    if (uploadedFiles.length > 0) {
      const limit = pLimit(3); // Limit to concurrent job creations

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
            message: UploadMessage.JOBS_CREATED,
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
            message: UploadMessage.JOBS_PARTIAL_FAILURE,
            batchId,
            failedCount: failed.length,
            errors: failed.map(
              (r) => (r as PromiseRejectedResult).reason?.message,
            ),
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
