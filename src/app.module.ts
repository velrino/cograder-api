import { Module } from '@nestjs/common';
import { FirebaseModule } from './shared/google/firebase/firebase.module';
import { ConfigModule } from '@nestjs/config';
import { JobsModule } from './modules/jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    FirebaseModule,
    JobsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
