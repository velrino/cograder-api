import { Global, Module } from '@nestjs/common';
import { FirebaseDatabaseService } from './firebase-database.service';

@Global()
@Module({
  providers: [FirebaseDatabaseService],
  exports: [FirebaseDatabaseService],
})
export class FirebaseModule {}
