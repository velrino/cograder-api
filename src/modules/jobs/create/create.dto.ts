import { IsNotEmpty, IsUrl } from 'class-validator';
import { ValidationMessage } from 'src/shared/constants/messages.enum';

export class CreateJobDto {
  @IsNotEmpty({ message: ValidationMessage.IMAGE_URL_REQUIRED })
  @IsUrl({}, { message: ValidationMessage.INVALID_URL_FORMAT })
  imageUrl: string;
}
