import { IsNotEmpty, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ValidationMessage } from 'src/shared/constants/messages.enum';

export class CreateJobDto {
  @ApiProperty({
    description: 'URL of the image to process (PNG, JPG, WEBP)',
    example: 'https://example.com/image.jpg',
    required: true
  })
  @IsNotEmpty({ message: ValidationMessage.IMAGE_URL_REQUIRED })
  @IsUrl({}, { message: ValidationMessage.INVALID_URL_FORMAT })
  imageUrl: string;
}
