import { Module } from '@nestjs/common';
import { FirebaseModule } from './shared/google/firebase/firebase.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JobsModule } from './modules/jobs/jobs.module';
import { QueueModule } from './modules/queue/queue.module';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    /*
     * Bull com Redis para fila
     */
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
        },
      }),
      inject: [ConfigService],
    }),
    FirebaseModule,
    JobsModule,
    QueueModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
