import { ApiProperty } from '@nestjs/swagger';

export class UploadedFileMetadataDto {
  @ApiProperty({
    description: 'Original filename',
    example: 'student-answer.png',
  })
  name: string;

  @ApiProperty({
    description: 'Public URL to access the file',
    example: 'https://storage.googleapis.com/...',
  })
  url: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 2048576,
  })
  size: number;

  @ApiProperty({
    description: 'MIME type',
    example: 'image/png',
  })
  mimeType: string;

  @ApiProperty({
    description: 'Upload timestamp',
    example: '2025-11-10T12:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Storage path in Firebase',
    example: 'uploads/1731240000000-student-answer.png',
  })
  storagePath: string;
}

export class UploadImagesResponseDto {
  @ApiProperty({
    description: 'List of successfully uploaded files',
    type: [UploadedFileMetadataDto],
  })
  files: UploadedFileMetadataDto[];

  @ApiProperty({
    description: 'List of files that failed to upload',
    type: [String],
    required: false,
  })
  failed?: string[];

  @ApiProperty({
    description: 'Unique batch ID grouping these uploaded images',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  batchId: string;
}
