import { ApiProperty } from '@nestjs/swagger';
import { JobStatus } from './job.interface';

export class JobResponseDto {
  @ApiProperty({ example: 'uuid-here' })
  id: string;

  @ApiProperty({ example: 'https://example.com/image.jpg' })
  imageUrl: string;

  @ApiProperty({ enum: JobStatus, example: JobStatus.waiting })
  status: JobStatus;

  @ApiProperty({ example: 0, minimum: 0, maximum: 100 })
  progress: number;

  @ApiProperty({ required: false, example: 'https://storage.googleapis.com/processed-image.png' })
  resultUrl?: string;

  @ApiProperty({ required: false })
  error?: string;

  @ApiProperty({
    required: false,
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Batch ID grouping related images together',
  })
  batchId?: string;

  @ApiProperty({ type: Date })
  createdAt: Date;

  @ApiProperty({ type: Date })
  updatedAt: Date;
}
