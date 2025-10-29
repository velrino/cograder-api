import { IsNotEmpty, IsUrl } from 'class-validator';

export class CreateJobDto {
  @IsNotEmpty({ message: 'Image URL is required' })
  @IsUrl({}, { message: 'Invalid URL format' })
  imageUrl: string;
}
