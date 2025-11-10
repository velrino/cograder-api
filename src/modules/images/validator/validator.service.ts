import {
  Injectable,
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import {
  ImageProcessingError,
  UploadError,
} from 'src/shared/constants/messages.enum';

export interface ImageValidationOptions {
  checkContent?: boolean; // If true, downloads and returns buffer
  timeout?: number; // Timeout in milliseconds
  maxSizeInMB?: number; // Maximum size in MB
}

export interface ImageValidationResult {
  buffer?: Buffer;
  contentType: string;
  sizeInMB: number;
}

@Injectable()
export class ImageValidatorService {
  async validate(
    imageUrl: string,
    options: ImageValidationOptions = {},
  ): Promise<ImageValidationResult> {
    const { checkContent = false, timeout = 5000, maxSizeInMB = 10 } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const method = checkContent ? 'GET' : 'HEAD';
      const response = await fetch(imageUrl, {
        method,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check if URL returns 404
      if (response.status === 404) {
        throw new BadRequestException(ImageProcessingError.NOT_FOUND);
      }

      if (!response.ok) {
        throw new BadRequestException(ImageProcessingError.HTTP_ERROR);
      }

      // Check Content-Type header to validate if it's an image
      const contentType = response.headers.get('content-type');
      const validImageTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
      ];

      if (
        !contentType ||
        !validImageTypes.some((type) => contentType.includes(type))
      ) {
        throw new BadRequestException(ImageProcessingError.INVALID_FORMAT);
      }

      let buffer: Buffer | undefined;
      let sizeInMB: number;

      if (checkContent) {
        // Download full content
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
        sizeInMB = buffer.length / (1024 * 1024);
      } else {
        // Check Content-Length header
        const contentLength = response.headers.get('content-length');
        if (contentLength) {
          sizeInMB = parseInt(contentLength) / (1024 * 1024);
        } else {
          // If Content-Length is not available, we can't validate size with HEAD
          sizeInMB = 0;
        }
      }

      // Validate size if available
      if (sizeInMB > 0 && sizeInMB > maxSizeInMB) {
        throw new BadRequestException(ImageProcessingError.TOO_LARGE);
      }

      return {
        buffer,
        contentType,
        sizeInMB,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof BadRequestException) {
        throw error;
      }

      if (error.name === 'AbortError') {
        throw new BadRequestException(ImageProcessingError.DOWNLOAD_TIMEOUT);
      }

      if (error.message?.includes('fetch failed')) {
        throw new BadRequestException(ImageProcessingError.NETWORK_ERROR);
      }

      throw new BadRequestException(ImageProcessingError.DOWNLOAD_FAILED);
    }
  }

  /**
   * Validate uploaded file (already in memory)
   */
  validateUploadedFile(
    file: Express.Multer.File,
    maxSizeInMB: number = 10,
  ): void {
    // Check if file exists
    if (!file || !file.buffer) {
      throw new BadRequestException(UploadError.INVALID_FILE);
    }

    // Allowed image MIME types
    const validImageTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    // Check MIME type
    if (!validImageTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `${UploadError.INVALID_FILE_TYPE}: ${file.originalname} has unsupported type. Allowed: ${validImageTypes.join(', ')}`,
      );
    }

    // Check file size
    const sizeInMB = file.size / (1024 * 1024);
    if (sizeInMB > maxSizeInMB) {
      throw new PayloadTooLargeException(
        `${UploadError.FILE_TOO_LARGE}: ${file.originalname} exceeds maximum size of ${maxSizeInMB}MB`,
      );
    }
  }
}
