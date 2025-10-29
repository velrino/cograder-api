import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { Log, LogAction, LogType } from 'src/shared/log/log.helper';
import {
  FirebaseMessage,
  FirebaseError,
} from 'src/shared/constants/messages.enum';

@Injectable()
export class FirebaseService implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    try {
      if (!process.env.GOOGLE_FIREBASE_ADMIN_SDK) {
        throw new Error(FirebaseError.SDK_ENV_NOT_SET);
      }

      const serviceAccount = JSON.parse(
        process.env.GOOGLE_FIREBASE_ADMIN_SDK || '{}',
      );

      // Check if the app is already initialized to avoid errors in tests/reloads
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: 'https://test-gograder-default-rtdb.firebaseio.com/',
          storageBucket: 'test-gograder.firebasestorage.app',
        });

        Log(
          LogType.INFO,
          FirebaseService.name,
          this.onModuleInit.name,
          LogAction.SUCCESS,
          {
            message: FirebaseMessage.SDK_INITIALIZED,
            databaseURL: 'https://test-gograder-default-rtdb.firebaseio.com/',
            storageBucket: 'test-gograder.firebasestorage.app',
          },
        );
      }
    } catch (error) {
      Log(
        LogType.ERROR,
        FirebaseService.name,
        this.onModuleInit.name,
        LogAction.FAILED,
        { error },
      );
      throw new Error(FirebaseError.SDK_INIT_FAILED);
    }
  }

  /**
   * Get Firebase Admin instance
   * Useful for getting the initialized app
   */
  getApp(): admin.app.App {
    return admin.app();
  }

  /**
   * Cleanup Firebase connections on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    try {
      if (admin.apps.length) {
        await Promise.all(admin.apps.map((app) => app?.delete()));

        Log(
          LogType.INFO,
          FirebaseService.name,
          'onModuleDestroy',
          LogAction.SUCCESS,
          { message: FirebaseMessage.CONNECTIONS_CLEANED },
        );
      }
    } catch (error) {
      Log(
        LogType.ERROR,
        FirebaseService.name,
        'onModuleDestroy',
        LogAction.FAILED,
        { error },
      );
    }
  }
}
