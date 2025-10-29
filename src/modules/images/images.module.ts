import { forwardRef, Module } from '@nestjs/common';
import { FirebaseModule } from 'src/shared/google/firebase/firebase.module';
import { ImageProcessingService } from './processing/processing.service';
import { ImageValidatorService } from './validator/validator.service';

@Module({
  imports: [forwardRef(() => FirebaseModule)],
  providers: [ImageProcessingService, ImageValidatorService],
  exports: [ImageValidatorService],
})
export class ImagesModule {}
