import { forwardRef, Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { FirebaseModule } from 'src/shared/google/firebase/firebase.module';
import { CreateJobService } from './create/create.service';
import { PaginateJobsService } from './paginate/paginate.service';
import { ImagesModule } from '../images/images.module';
import { GetJobService } from './get/get.service';
import { UploadImagesService } from './upload/upload.service';

@Module({
  imports: [forwardRef(() => ImagesModule), FirebaseModule],
  controllers: [JobsController],
  providers: [
    CreateJobService,
    PaginateJobsService,
    GetJobService,
    UploadImagesService,
  ],
  exports: [CreateJobService],
})
export class JobsModule {}
