import { forwardRef, Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { QueueModule } from '../queue/queue.module';
import { FirebaseModule } from 'src/shared/google/firebase/firebase.module';
import { CreateJobService } from './create/create.service';
import { PaginateJobsService } from './paginate/paginate.service';
import { ImagesModule } from '../images/images.module';

@Module({
  imports: [forwardRef(() => ImagesModule), FirebaseModule],
  controllers: [JobsController],
  providers: [CreateJobService, PaginateJobsService],
  exports: [CreateJobService],
})
export class JobsModule {}
