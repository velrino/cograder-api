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
        const helper = {
          databaseURL:
            'https://cograder-test-4348a-default-rtdb.firebaseio.com/',
          storageBucket: 'cograder-test-4348a.firebasestorage.app',
        };
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          ...helper,
        });

        Log(
          LogType.INFO,
          FirebaseService.name,
          this.onModuleInit.name,
          LogAction.SUCCESS,
          {
            ...helper,
            message: FirebaseMessage.SDK_INITIALIZED,
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
   * Ping Firebase Realtime Database to check connection
   */
  async ping(): Promise<boolean> {
    try {
      const database = admin.database();
      const ref = database.ref('.info/connected');
      const snapshot = await ref.once('value');
      const connected = snapshot.val();
      return connected === true;
    } catch (error) {
      Log(LogType.ERROR, FirebaseService.name, 'ping', LogAction.FAILED, {
        error,
      });
      return false;
    }
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
