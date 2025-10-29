import { BullModule } from '@nestjs/bull';
import { Global, Module } from '@nestjs/common';
import { QueuesEnum } from './queue.interface';
import { QueueService } from './queue.service';
import { ImagesModule } from '../images/images.module';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({
      name: QueuesEnum.IMAGE_PROCESSING,
    }),
    ImagesModule,
  ],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
