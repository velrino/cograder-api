import { Global, Module } from '@nestjs/common';
import { FirebaseService } from './firebase.service';
import { FirebaseDatabaseService } from './database/database.service';
import { FirebaseStorageService } from './storage/firebase-storage.service';

@Global()
@Module({
  providers: [
    FirebaseService, // Must be first to initialize Firebase
    FirebaseDatabaseService,
    FirebaseStorageService,
  ],
  exports: [FirebaseService, FirebaseDatabaseService, FirebaseStorageService],
})
export class FirebaseModule {}
