import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { Log, LogAction, LogType } from 'src/shared/log/log.helper';

@Injectable()
export class FirebaseService implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    try {
      if (!process.env.GOOGLE_FIREBASE_ADMIN_SDK) {
        throw new Error(
          'GOOGLE_FIREBASE_ADMIN_SDK environment variable is not set',
        );
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
            message: '✅ Firebase Admin SDK initialized',
            databaseURL: 'https://test-gograder-default-rtdb.firebaseio.com/',
            storageBucket: 'test-gograder.firebasestorage.app',
          },
        );
      }
    } catch (error) {
      const about = 'Firebase Admin SDK initialization error';
      Log(
        LogType.ERROR,
        FirebaseService.name,
        this.onModuleInit.name,
        LogAction.FAILED,
        { about, error },
      );
      throw new Error(about);
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
          { message: 'Firebase connections cleaned up' },
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
