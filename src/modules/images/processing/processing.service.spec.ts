import { Test, TestingModule } from '@nestjs/testing';
import { ImageProcessingService } from './processing.service';
import { FirebaseDatabaseService } from 'src/shared/google/firebase/database/database.service';
import { FirebaseStorageService } from 'src/shared/google/firebase/storage/storage.service';
import { ImageValidatorService } from '../validator/validator.service';
import { Job } from 'bull';
import { IImageProcessingJob } from 'src/shared/queue/queue.service';
import { JobStatus } from 'src/modules/jobs/job.interface';
import { ImageProcessingError } from 'src/shared/constants/messages.enum';
import * as sharp from 'sharp';

describe('ImageProcessingService', () => {
  let service: ImageProcessingService;
  let firebaseDatabase: jest.Mocked<FirebaseDatabaseService>;
  let firebaseStorage: jest.Mocked<FirebaseStorageService>;
  let imageValidator: jest.Mocked<ImageValidatorService>;

  // Test data
  const mockJobId = 'test-job-123';
  const mockImageUrl = 'https://example.com/image.jpg';
  const mockResultUrl = 'https://storage.firebase.com/processed-image.png';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImageProcessingService,
        {
          provide: FirebaseDatabaseService,
          useValue: {
            save: jest.fn(),
          },
        },
        {
          provide: FirebaseStorageService,
          useValue: {
            uploadFile: jest.fn(),
          },
        },
        {
          provide: ImageValidatorService,
          useValue: {
            validate: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ImageProcessingService>(ImageProcessingService);
    firebaseDatabase = module.get(FirebaseDatabaseService);
    firebaseStorage = module.get(FirebaseStorageService);
    imageValidator = module.get(ImageValidatorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processImage - Positive Scenarios', () => {
    let mockJob: jest.Mocked<Job<IImageProcessingJob>>;

    beforeEach(() => {
      mockJob = {
        data: {
          jobId: mockJobId,
          imageUrl: mockImageUrl,
        },
        progress: jest.fn().mockResolvedValue(undefined),
      } as any;
    });

    it('should successfully process a valid JPEG image', async () => {
      // Arrange
      const validJpegBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 0, b: 0 },
        },
      })
        .jpeg()
        .toBuffer();

      imageValidator.validate.mockResolvedValue({
        buffer: validJpegBuffer,
        contentType: 'image/jpeg',
        sizeInMB: validJpegBuffer.length / (1024 * 1024),
      });
      firebaseStorage.uploadFile.mockResolvedValue(mockResultUrl);

      // Act
      await service.processImage(mockJob);

      // Assert
      expect(imageValidator.validate).toHaveBeenCalledWith(mockImageUrl, {
        checkContent: true,
        timeout: 10000,
        maxSizeInMB: 10,
      });
      expect(firebaseStorage.uploadFile).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.stringContaining('images/processed-'),
        expect.objectContaining({
          contentType: 'image/png',
          metadata: expect.objectContaining({
            jobId: mockJobId,
          }),
        }),
      );
      expect(firebaseDatabase.save).toHaveBeenLastCalledWith(
        expect.any(String),
        mockJobId,
        expect.objectContaining({
          status: JobStatus.completed,
          progress: 100,
          resultUrl: mockResultUrl,
        }),
      );
      expect(mockJob.progress).toHaveBeenCalledWith(100);
    });

    it('should successfully process a valid PNG image', async () => {
      // Arrange
      const validPngBuffer = await sharp({
        create: {
          width: 200,
          height: 150,
          channels: 4,
          background: { r: 0, g: 255, b: 0, alpha: 1 },
        },
      })
        .png()
        .toBuffer();

      imageValidator.validate.mockResolvedValue({
        buffer: validPngBuffer,
        contentType: 'image/png',
        sizeInMB: validPngBuffer.length / (1024 * 1024),
      });
      firebaseStorage.uploadFile.mockResolvedValue(mockResultUrl);

      // Act
      await service.processImage(mockJob);

      // Assert
      expect(imageValidator.validate).toHaveBeenCalled();
      expect(firebaseStorage.uploadFile).toHaveBeenCalled();
      expect(firebaseDatabase.save).toHaveBeenLastCalledWith(
        expect.any(String),
        mockJobId,
        expect.objectContaining({
          status: JobStatus.completed,
        }),
      );
    });

    it('should successfully process a valid WEBP image', async () => {
      // Arrange
      const validWebpBuffer = await sharp({
        create: {
          width: 300,
          height: 200,
          channels: 3,
          background: { r: 0, g: 0, b: 255 },
        },
      })
        .webp()
        .toBuffer();

      imageValidator.validate.mockResolvedValue({
        buffer: validWebpBuffer,
        contentType: 'image/webp',
        sizeInMB: validWebpBuffer.length / (1024 * 1024),
      });
      firebaseStorage.uploadFile.mockResolvedValue(mockResultUrl);

      // Act
      await service.processImage(mockJob);

      // Assert
      expect(firebaseDatabase.save).toHaveBeenLastCalledWith(
        expect.any(String),
        mockJobId,
        expect.objectContaining({
          status: JobStatus.completed,
          progress: 100,
        }),
      );
    });

    it('should update job status at each processing step', async () => {
      // Arrange
      const validImageBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 128, g: 128, b: 128 },
        },
      })
        .jpeg()
        .toBuffer();

      imageValidator.validate.mockResolvedValue({
        buffer: validImageBuffer,
        contentType: 'image/jpeg',
        sizeInMB: validImageBuffer.length / (1024 * 1024),
      });
      firebaseStorage.uploadFile.mockResolvedValue(mockResultUrl);

      // Act
      await service.processImage(mockJob);

      // Assert - Verify all progress updates (6 total: 10%, 30%, 40%, 70%, 90%, 100%)
      expect(firebaseDatabase.save).toHaveBeenCalledTimes(6);
      expect(firebaseDatabase.save).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        mockJobId,
        expect.objectContaining({ progress: 10, status: JobStatus.active }),
      );
      expect(firebaseDatabase.save).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        mockJobId,
        expect.objectContaining({ progress: 30, status: JobStatus.active }),
      );
      expect(firebaseDatabase.save).toHaveBeenNthCalledWith(
        3,
        expect.any(String),
        mockJobId,
        expect.objectContaining({ progress: 40, status: JobStatus.active }),
      );
      expect(firebaseDatabase.save).toHaveBeenNthCalledWith(
        4,
        expect.any(String),
        mockJobId,
        expect.objectContaining({ progress: 70, status: JobStatus.active }),
      );
      expect(firebaseDatabase.save).toHaveBeenNthCalledWith(
        5,
        expect.any(String),
        mockJobId,
        expect.objectContaining({ progress: 90, status: JobStatus.active }),
      );
      expect(firebaseDatabase.save).toHaveBeenNthCalledWith(
        6,
        expect.any(String),
        mockJobId,
        expect.objectContaining({ progress: 100, status: JobStatus.completed }),
      );
    });

    it('should apply transformations (resize, grayscale, watermark) correctly', async () => {
      // Arrange
      const largeImageBuffer = await sharp({
        create: {
          width: 2000,
          height: 1500,
          channels: 3,
          background: { r: 100, g: 150, b: 200 },
        },
      })
        .jpeg()
        .toBuffer();

      imageValidator.validate.mockResolvedValue({
        buffer: largeImageBuffer,
        contentType: 'image/jpeg',
        sizeInMB: largeImageBuffer.length / (1024 * 1024),
      });

      let uploadedBuffer: Buffer | undefined;
      firebaseStorage.uploadFile.mockImplementation(
        async (buffer: Buffer) => {
          uploadedBuffer = buffer;
          return mockResultUrl;
        },
      );

      // Act
      await service.processImage(mockJob);

      // Assert
      expect(uploadedBuffer).toBeDefined();
      const metadata = await sharp(uploadedBuffer!).metadata();
      expect(metadata.width).toBeLessThanOrEqual(800);
      expect(metadata.height).toBeLessThanOrEqual(600);
      expect(metadata.format).toBe('png');
    });

    it('should update job progress correctly throughout the process', async () => {
      // Arrange
      const validImageBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .jpeg()
        .toBuffer();

      imageValidator.validate.mockResolvedValue({
        buffer: validImageBuffer,
        contentType: 'image/jpeg',
        sizeInMB: validImageBuffer.length / (1024 * 1024),
      });
      firebaseStorage.uploadFile.mockResolvedValue(mockResultUrl);

      // Act
      await service.processImage(mockJob);

      // Assert
      expect(mockJob.progress).toHaveBeenCalledWith(10);
      expect(mockJob.progress).toHaveBeenCalledWith(30);
      expect(mockJob.progress).toHaveBeenCalledWith(70);
      expect(mockJob.progress).toHaveBeenCalledWith(90);
      expect(mockJob.progress).toHaveBeenCalledWith(100);
    });
  });

  describe('processImage - Negative Scenarios', () => {
    let mockJob: jest.Mocked<Job<IImageProcessingJob>>;

    beforeEach(() => {
      mockJob = {
        data: {
          jobId: mockJobId,
          imageUrl: mockImageUrl,
        },
        progress: jest.fn().mockResolvedValue(undefined),
      } as any;
    });

    it('should fail when image download fails', async () => {
      // Arrange
      imageValidator.validate.mockRejectedValue(
        new Error('Network error'),
      );

      // Act & Assert
      await expect(service.processImage(mockJob)).rejects.toThrow(
        ImageProcessingError.DOWNLOAD_FAILED,
      );
      expect(firebaseDatabase.save).toHaveBeenCalledWith(
        expect.any(String),
        mockJobId,
        expect.objectContaining({
          status: JobStatus.failed,
          error: ImageProcessingError.DOWNLOAD_FAILED,
        }),
      );
    });

    it('should fail when validator returns no buffer', async () => {
      // Arrange
      imageValidator.validate.mockResolvedValue({
        buffer: undefined,
        contentType: 'image/jpeg',
        sizeInMB: 0,
      });

      // Act & Assert
      await expect(service.processImage(mockJob)).rejects.toThrow(
        ImageProcessingError.DOWNLOAD_FAILED,
      );
      expect(firebaseDatabase.save).toHaveBeenCalledWith(
        expect.any(String),
        mockJobId,
        expect.objectContaining({
          status: JobStatus.failed,
        }),
      );
    });

    it('should fail when image format is invalid', async () => {
      // Arrange
      const invalidBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .tiff()
        .toBuffer();

      imageValidator.validate.mockResolvedValue({
        buffer: invalidBuffer,
        contentType: 'image/tiff',
        sizeInMB: invalidBuffer.length / (1024 * 1024),
      });

      // Act & Assert
      await expect(service.processImage(mockJob)).rejects.toThrow(
        ImageProcessingError.INVALID_FORMAT,
      );
      expect(firebaseDatabase.save).toHaveBeenCalledWith(
        expect.any(String),
        mockJobId,
        expect.objectContaining({
          status: JobStatus.failed,
          error: ImageProcessingError.INVALID_FORMAT,
        }),
      );
    });

    it('should fail when image size exceeds 10MB', async () => {
      // Arrange
      const largeBuffer = Buffer.alloc(11 * 1024 * 1024); // 11MB
      imageValidator.validate.mockResolvedValue({
        buffer: largeBuffer,
        contentType: 'image/jpeg',
        sizeInMB: largeBuffer.length / (1024 * 1024),
      });

      // Act & Assert
      await expect(service.processImage(mockJob)).rejects.toThrow();
      expect(firebaseDatabase.save).toHaveBeenCalledWith(
        expect.any(String),
        mockJobId,
        expect.objectContaining({
          status: JobStatus.failed,
        }),
      );
    });

    it('should fail when buffer is not a valid image', async () => {
      // Arrange
      const invalidBuffer = Buffer.from('not an image');
      imageValidator.validate.mockResolvedValue({
        buffer: invalidBuffer,
        contentType: 'image/jpeg',
        sizeInMB: invalidBuffer.length / (1024 * 1024),
      });

      // Act & Assert
      await expect(service.processImage(mockJob)).rejects.toThrow(
        ImageProcessingError.INVALID_FILE,
      );
      expect(firebaseDatabase.save).toHaveBeenCalledWith(
        expect.any(String),
        mockJobId,
        expect.objectContaining({
          status: JobStatus.failed,
          error: ImageProcessingError.INVALID_FILE,
        }),
      );
    });

    it('should fail when Firebase Storage upload fails', async () => {
      // Arrange
      const validImageBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .jpeg()
        .toBuffer();

      imageValidator.validate.mockResolvedValue({
        buffer: validImageBuffer,
        contentType: 'image/jpeg',
        sizeInMB: validImageBuffer.length / (1024 * 1024),
      });
      firebaseStorage.uploadFile.mockRejectedValue(
        new Error('Storage error'),
      );

      // Act & Assert
      await expect(service.processImage(mockJob)).rejects.toThrow(
        ImageProcessingError.UPLOAD_FAILED,
      );
      expect(firebaseDatabase.save).toHaveBeenCalledWith(
        expect.any(String),
        mockJobId,
        expect.objectContaining({
          status: JobStatus.failed,
          error: ImageProcessingError.UPLOAD_FAILED,
        }),
      );
    });

    it('should handle validator errors with response message', async () => {
      // Arrange
      const errorWithResponse = {
        response: {
          message: 'Invalid URL provided',
        },
      };
      imageValidator.validate.mockRejectedValue(errorWithResponse);

      // Act & Assert
      await expect(service.processImage(mockJob)).rejects.toThrow(
        'Invalid URL provided',
      );
      expect(firebaseDatabase.save).toHaveBeenCalledWith(
        expect.any(String),
        mockJobId,
        expect.objectContaining({
          status: JobStatus.failed,
          error: 'Invalid URL provided',
        }),
      );
    });

    it('should fail gracefully when transformation fails', async () => {
      // Arrange - Create a buffer that will cause sharp to fail during transformation
      const corruptedBuffer = Buffer.from('corrupted-image-data');
      imageValidator.validate.mockResolvedValue({
        buffer: corruptedBuffer,
        contentType: 'image/jpeg',
        sizeInMB: corruptedBuffer.length / (1024 * 1024),
      });

      // Mock sharp metadata to pass validation
      jest.spyOn(sharp.prototype, 'metadata').mockResolvedValueOnce({
        format: 'jpeg',
        width: 100,
        height: 100,
      } as any);

      // Act & Assert
      await expect(service.processImage(mockJob)).rejects.toThrow(
        ImageProcessingError.TRANSFORMATION_FAILED,
      );
      expect(firebaseDatabase.save).toHaveBeenCalledWith(
        expect.any(String),
        mockJobId,
        expect.objectContaining({
          status: JobStatus.failed,
        }),
      );
    });

    it('should update job status to failed when any step fails', async () => {
      // Arrange
      imageValidator.validate.mockRejectedValue(
        new Error('Connection timeout'),
      );

      // Act
      try {
        await service.processImage(mockJob);
      } catch (error) {
        // Expected to throw
      }

      // Assert
      expect(firebaseDatabase.save).toHaveBeenCalledWith(
        expect.any(String),
        mockJobId,
        expect.objectContaining({
          status: JobStatus.failed,
          progress: 0,
        }),
      );
    });
  });

  describe('Edge Cases', () => {
    let mockJob: jest.Mocked<Job<IImageProcessingJob>>;

    beforeEach(() => {
      mockJob = {
        data: {
          jobId: mockJobId,
          imageUrl: mockImageUrl,
        },
        progress: jest.fn().mockResolvedValue(undefined),
      } as any;
    });

    it('should handle minimum size image (1x1)', async () => {
      // Arrange
      const tinyImageBuffer = await sharp({
        create: {
          width: 1,
          height: 1,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .jpeg()
        .toBuffer();

      imageValidator.validate.mockResolvedValue({
        buffer: tinyImageBuffer,
        contentType: 'image/jpeg',
        sizeInMB: tinyImageBuffer.length / (1024 * 1024),
      });
      firebaseStorage.uploadFile.mockResolvedValue(mockResultUrl);

      // Act & Assert
      await expect(service.processImage(mockJob)).resolves.not.toThrow();
      expect(firebaseDatabase.save).toHaveBeenLastCalledWith(
        expect.any(String),
        mockJobId,
        expect.objectContaining({
          status: JobStatus.completed,
        }),
      );
    });

    it('should handle image exactly at 10MB limit', async () => {
      // Arrange - Create buffer of exactly 10MB
      const exactSizeBuffer = Buffer.alloc(10 * 1024 * 1024);

      // Create a valid JPEG header
      const validJpegBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .jpeg()
        .toBuffer();

      // Copy valid JPEG data to exact size buffer
      validJpegBuffer.copy(exactSizeBuffer);

      imageValidator.validate.mockResolvedValue({
        buffer: exactSizeBuffer,
        contentType: 'image/jpeg',
        sizeInMB: exactSizeBuffer.length / (1024 * 1024),
      });
      firebaseStorage.uploadFile.mockResolvedValue(mockResultUrl);

      // Act & Assert
      await expect(service.processImage(mockJob)).resolves.not.toThrow();
    });

    it('should not enlarge images smaller than target dimensions', async () => {
      // Arrange
      const smallImageBuffer = await sharp({
        create: {
          width: 400,
          height: 300,
          channels: 3,
          background: { r: 128, g: 128, b: 128 },
        },
      })
        .jpeg()
        .toBuffer();

      imageValidator.validate.mockResolvedValue({
        buffer: smallImageBuffer,
        contentType: 'image/jpeg',
        sizeInMB: smallImageBuffer.length / (1024 * 1024),
      });

      let uploadedBuffer: Buffer | undefined;
      firebaseStorage.uploadFile.mockImplementation(
        async (buffer: Buffer) => {
          uploadedBuffer = buffer;
          return mockResultUrl;
        },
      );

      // Act
      await service.processImage(mockJob);

      // Assert - Image should not be enlarged
      expect(uploadedBuffer).toBeDefined();
      const metadata = await sharp(uploadedBuffer!).metadata();
      expect(metadata.width).toBeLessThanOrEqual(400);
      expect(metadata.height).toBeLessThanOrEqual(300);
    });

    it('should continue processing even if status update fails', async () => {
      // Arrange
      const validImageBuffer = await sharp({
        create: {
          width: 100,
          height: 100,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .jpeg()
        .toBuffer();

      imageValidator.validate.mockResolvedValue({
        buffer: validImageBuffer,
        contentType: 'image/jpeg',
        sizeInMB: validImageBuffer.length / (1024 * 1024),
      });
      firebaseStorage.uploadFile.mockResolvedValue(mockResultUrl);

      // Make first status update fail, but not throw
      firebaseDatabase.save.mockRejectedValueOnce(
        new Error('Database error'),
      );

      // Act & Assert - Should still complete successfully
      await expect(service.processImage(mockJob)).resolves.not.toThrow();
    });
  });
});
