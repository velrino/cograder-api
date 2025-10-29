import { forwardRef, Module } from '@nestjs/common';
import { FirebaseModule } from 'src/shared/google/firebase/firebase.module';
import { ImageProcessingService } from './processing/processing.service';

@Module({
  imports: [forwardRef(() => FirebaseModule)],
  providers: [ImageProcessingService],
  exports: [],
})
export class ImagesModule {}
