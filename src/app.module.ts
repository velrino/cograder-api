import { Module } from '@nestjs/common';
import { FirebaseModule } from './shared/google/firebase/firebase.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    FirebaseModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
