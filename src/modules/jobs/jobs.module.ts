import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { QueueModule } from '../queue/queue.module';
import { FirebaseModule } from 'src/shared/google/firebase/firebase.module';
import { CreateJobService } from './create/create.service';

@Module({
  imports: [QueueModule, FirebaseModule],
  controllers: [JobsController],
  providers: [CreateJobService],
  exports: [CreateJobService],
})
export class JobsModule {}
