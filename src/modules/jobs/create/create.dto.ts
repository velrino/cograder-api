import { IsNotEmpty, IsUrl, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ValidationMessage } from 'src/shared/constants/messages.enum';

export class CreateJobDto {
  @ApiProperty({
    description: 'URL of the image to process (PNG, JPG, WEBP)',
    example: 'https://example.com/image.jpg',
    required: true,
  })
  @IsNotEmpty({ message: ValidationMessage.IMAGE_URL_REQUIRED })
  @IsUrl({}, { message: ValidationMessage.INVALID_URL_FORMAT })
  imageUrl: string;

  @ApiProperty({
    description: 'Optional batch ID to group related images together',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'Batch ID must be a valid UUID v4' })
  batchId?: string;
}
