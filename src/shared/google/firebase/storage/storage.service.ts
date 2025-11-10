import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { Log, LogAction, LogType } from 'src/shared/log/log.helper';

@Injectable()
export class FirebaseStorageService implements OnModuleInit {
  private bucket: ReturnType<admin.storage.Storage['bucket']>;

  constructor() {}

  onModuleInit() {
    // Firebase is already initialized by FirebaseInitService
    this.bucket = admin.storage().bucket();

    Log(
      LogType.INFO,
      FirebaseStorageService.name,
      this.onModuleInit.name,
      LogAction.SUCCESS,
      {
        message: '✅ Firebase Storage ready',
        bucketName: this.bucket.name,
      },
    );
  }

  /**
   * Upload a file to Firebase Storage
   * @param buffer - File buffer to upload
   * @param destination - Path in storage (e.g., 'images/filename.png')
   * @param metadata - Optional metadata for the file
   * @returns Public URL of the uploaded file
   */
  async uploadFile(
    buffer: Buffer,
    destination: string,
    metadata?: {
      contentType?: string;
      metadata?: Record<string, string>;
    },
  ): Promise<string> {
    try {
      const file = this.bucket.file(destination);

      // Upload file with public access
      await file.save(buffer, {
        metadata: {
          contentType: metadata?.contentType || 'image/png',
          metadata: metadata?.metadata || {},
        },
        validation: 'md5',
        public: true, // Make file publicly accessible
      });

      // Use public URL (no signed URL needed)
      const publicUrl = `https://storage.googleapis.com/${this.bucket.name}/${destination}`;

      Log(
        LogType.INFO,
        FirebaseStorageService.name,
        this.uploadFile.name,
        LogAction.SUCCESS,
        {
          destination,
          size: buffer.length,
          publicUrl,
        },
      );

      return publicUrl;
    } catch (error) {
      Log(
        LogType.ERROR,
        FirebaseStorageService.name,
        this.uploadFile.name,
        LogAction.FAILED,
        { destination, error },
      );
      throw new Error(`Failed to upload file to storage: ${error.message}`);
    }
  }

  /**
   * Delete a file from Firebase Storage
   * @param path - Path to the file in storage
   */
  async deleteFile(path: string): Promise<void> {
    try {
      const file = this.bucket.file(path);
      await file.delete();

      Log(
        LogType.INFO,
        FirebaseStorageService.name,
        this.deleteFile.name,
        LogAction.SUCCESS,
        { path },
      );
    } catch (error) {
      Log(
        LogType.ERROR,
        FirebaseStorageService.name,
        this.deleteFile.name,
        LogAction.FAILED,
        { path, error },
      );
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  /**
   * Get a signed URL for temporary access to a private file
   * @param path - Path to the file in storage
   * @param expiresInMinutes - Expiration time in minutes (default 60)
   */
  async getSignedUrl(
    path: string,
    expiresInMinutes: number = 60,
  ): Promise<string> {
    try {
      const file = this.bucket.file(path);
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + expiresInMinutes * 60 * 1000,
      });

      return url;
    } catch (error) {
      Log(
        LogType.ERROR,
        FirebaseStorageService.name,
        this.getSignedUrl.name,
        LogAction.FAILED,
        { path, error },
      );
      throw new Error(`Failed to get signed URL: ${error.message}`);
    }
  }

  /**
   * Check if a file exists in storage
   * @param path - Path to check
   */
  async fileExists(path: string): Promise<boolean> {
    try {
      const file = this.bucket.file(path);
      const [exists] = await file.exists();
      return exists;
    } catch (error) {
      Log(
        LogType.ERROR,
        FirebaseStorageService.name,
        this.fileExists.name,
        LogAction.FAILED,
        { path, error },
      );
      return false;
    }
  }

  /**
   * Get file metadata
   * @param path - Path to the file
   */
  async getFileMetadata(path: string): Promise<any> {
    try {
      const file = this.bucket.file(path);
      const [metadata] = await file.getMetadata();
      return metadata;
    } catch (error) {
      Log(
        LogType.ERROR,
        FirebaseStorageService.name,
        this.getFileMetadata.name,
        LogAction.FAILED,
        { path, error },
      );
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }
}
