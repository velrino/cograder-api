import { Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as admin from 'firebase-admin';
import { Log, LogAction, LogType } from 'src/shared/log/log.helper';
import { Environments, GetEnvironment } from 'src/shared/general/enviroment';
import {
  FirebaseDatabasePath,
  IFirebaseDatabaseListenForNewRecords,
} from './database.enum';

@Injectable()
export class FirebaseDatabaseService implements OnModuleInit {
  public database: admin.database.Database;
  private readonly workerId = randomUUID();

  constructor() {}

  async onModuleInit(): Promise<void> {
    try {
      // Firebase is already initialized by FirebaseInitService
      this.database = admin.database();

      Log(
        LogType.INFO,
        FirebaseDatabaseService.name,
        this.onModuleInit.name,
        LogAction.SUCCESS,
        { message: '✅ Firebase Realtime Database ready' },
      );
    } catch (error) {
      const about = 'Firebase Realtime Database initialization error';
      Log(
        LogType.ERROR,
        FirebaseDatabaseService.name,
        this.onModuleInit.name,
        LogAction.FAILED,
        { about, error },
      );
      throw new Error(about);
    }
  }

  // Resolve RTDB path by environment to avoid mixing DEV and RELEASE data
  private p(informed: FirebaseDatabasePath): string {
    // const env = GetEnvironment();

    // const firebasePath = Object.values(Environments).includes(
    //   env as Environments,
    // )
    //   ? informed
    //   : `DEV_${String(informed).toUpperCase()}`;

    return String(informed).toUpperCase();
  }

  // Set data at the root of a path (no id), with server timestamp
  async setRoot(path: FirebaseDatabasePath, data: any): Promise<void> {
    try {
      const ref = this.database.ref(this.p(path));
      await ref.set({
        ...data,
        timestamp: admin.database.ServerValue.TIMESTAMP,
      });
    } catch (error) {
      Log(
        LogType.ERROR,
        FirebaseDatabaseService.name,
        this.setRoot.name,
        LogAction.FAILED,
        { path, data, error },
      );
      throw error;
    }
  }

  async save(path: FirebaseDatabasePath, id: string, data: any): Promise<void> {
    try {
      // Use Admin SDK methods for Realtime Database
      const deviceRef = this.database.ref(`${this.p(path)}/${id}`);
      return await deviceRef.set({
        ...data,
        timestamp: admin.database.ServerValue.TIMESTAMP, // Use server timestamp, it's better!
      });
    } catch (error) {
      Log(
        LogType.ERROR,
        FirebaseDatabaseService.name,
        this.save.name,
        LogAction.FAILED,
        { data, error },
      );
      throw error;
    }
  }

  // Add a new record with auto-generated ID
  async addRecord(path: FirebaseDatabasePath, data: any): Promise<string> {
    try {
      const ref = this.database.ref(this.p(path));
      const newRecordRef = ref.push(); // Create a reference with automatic ID

      await newRecordRef.set({
        ...data,
        timestamp: admin.database.ServerValue.TIMESTAMP,
      });

      return newRecordRef.key; // Return the new record ID
    } catch (error) {
      Log(
        LogType.ERROR,
        FirebaseDatabaseService.name,
        this.addRecord.name,
        LogAction.FAILED,
        { data, error },
      );
      throw error;
    }
  }

  // Listen for new records added to a path
  async listenForNewRecords(
    parameters: IFirebaseDatabaseListenForNewRecords,
  ): Promise<() => void> {
    try {
      const ref = this.database.ref(this.p(parameters.path));

      // Listener for new records
      const childAddedHandler = ref.on('child_added', async (snapshot) => {
        try {
          const data = snapshot.val();
          const key = snapshot.key;

          if (data && key) {
            // Try to atomically claim the record to avoid duplicate processing
            const claimed = await this.tryClaimRecord(parameters.path, key);

            if (!claimed) return; // Another instance already claimed or already processed

            try {
              await parameters.callback(data, key);
              // await this.markRecordProcessed(parameters.path, key);
            } catch (callbackError) {
              // If processing fails, release the claim for future retry
              await this.releaseClaim(parameters.path, key);
              throw callbackError;
            }
          }
        } catch (error) {
          Log(
            LogType.ERROR,
            FirebaseDatabaseService.name,
            'childAddedHandler',
            LogAction.FAILED,
            { error, parameters },
          );
        }
      });

      // Return a function to remove the listener
      return () => ref.off('child_added', childAddedHandler);
    } catch (error) {
      Log(
        LogType.ERROR,
        FirebaseDatabaseService.name,
        this.listenForNewRecords.name,
        LogAction.FAILED,
        { error, parameters },
      );
      throw error;
    }
  }

  // Implements a "claim" with lease to avoid parallel processing
  private async tryClaimRecord(
    path: FirebaseDatabasePath,
    id: string,
    leaseMs = 60_000, // 1 minute lease by default
  ): Promise<boolean> {
    const now = Date.now();
    const ref = this.database.ref(`${this.p(path)}/${id}`);

    try {
      const result = await new Promise<{
        committed: boolean;
        snapshot?: admin.database.DataSnapshot;
      }>((resolve, reject) => {
        ref.transaction(
          (current: any) => {
            if (!current) return; // record removed
            if (current.processed) return; // already processed -> no change (committed: false)

            const claimedAt = Number(current.claimed_at || 0);
            const hasClaim = Boolean(current.claimed_by);
            const isLeaseValid =
              hasClaim && claimedAt && now - claimedAt < leaseMs;

            if (isLeaseValid && current.claimed_by !== this.workerId) {
              // Another worker still holds the lease
              return; // no update -> committed false
            }

            // Claim/renew the lease
            return {
              ...current,
              claimed_by: this.workerId,
              claimed_at: now,
            };
          },
          (error, committed, snapshot) => {
            if (error) return reject(error);
            resolve({
              committed: Boolean(committed),
              snapshot: snapshot as any,
            });
          },
          false,
        );
      });

      return result.committed;
    } catch (error) {
      Log(
        LogType.ERROR,
        FirebaseDatabaseService.name,
        'tryClaimRecord',
        LogAction.FAILED,
        { error, path, id },
      );
      return false;
    }
  }

  private async markRecordProcessed(
    path: FirebaseDatabasePath,
    id: string,
  ): Promise<void> {
    try {
      const ref = this.database.ref(`${this.p(path)}/${id}`);
      await ref.update({
        processed: true,
        processed_at: Date.now(),
        processed_by: this.workerId,
      });
    } catch (error) {
      Log(
        LogType.ERROR,
        FirebaseDatabaseService.name,
        'markRecordProcessed',
        LogAction.FAILED,
        { error, path, id },
      );
    }
  }

  private async releaseClaim(
    path: FirebaseDatabasePath,
    id: string,
  ): Promise<void> {
    try {
      const ref = this.database.ref(`${this.p(path)}/${id}`);
      const snapshot = await ref.once('value');
      const value = snapshot.val();
      if (value?.claimed_by === this.workerId && !value?.processed) {
        await ref.update({ claimed_by: null, claimed_at: null });
      }
    } catch (error) {
      Log(
        LogType.ERROR,
        FirebaseDatabaseService.name,
        'releaseClaim',
        LogAction.FAILED,
        { error, path, id },
      );
    }
  }

  // Distributed lock helpers (for crons and unique jobs)
  async acquireLock(
    name: string,
    leaseMs = 30 * 60 * 1000, // 30 minutes by default
  ): Promise<boolean> {
    const now = Date.now();
    const ref = this.database.ref(
      `${this.p(FirebaseDatabasePath.LOCKS)}/${name}`,
    );
    try {
      const result = await new Promise<{ committed: boolean }>(
        (resolve, reject) => {
          ref.transaction(
            (current: any) => {
              const claimedAt = Number(current?.claimed_at || 0);
              const claimedBy = current?.claimed_by as string | undefined;
              const isLeaseValid =
                claimedBy && claimedAt && now - claimedAt < leaseMs;

              if (isLeaseValid && claimedBy !== this.workerId) {
                // Another worker still holds the lease
                return; // no change
              }

              // Acquire or renew lease
              return {
                claimed_by: this.workerId,
                claimed_at: now,
              };
            },
            (error, committed) => {
              if (error) return reject(error);
              resolve({ committed: Boolean(committed) });
            },
            false,
          );
        },
      );
      return result.committed;
    } catch (error) {
      Log(
        LogType.ERROR,
        FirebaseDatabaseService.name,
        'acquireLock',
        LogAction.FAILED,
        { error, name },
      );
      return false;
    }
  }

  async releaseLock(name: string): Promise<void> {
    const ref = this.database.ref(
      `${this.p(FirebaseDatabasePath.LOCKS)}/${name}`,
    );
    try {
      await ref.transaction((current: any) => {
        if (current?.claimed_by === this.workerId) {
          return null; // remove lock
        }
        return; // no change if not the owner
      });
    } catch (error) {
      Log(
        LogType.ERROR,
        FirebaseDatabaseService.name,
        'releaseLock',
        LogAction.FAILED,
        { error, name },
      );
    }
  }

  // Method to delete a record
  async deleteRecord(path: FirebaseDatabasePath, id: string): Promise<void> {
    try {
      const ref = this.database.ref(`${this.p(path)}/${id}`);
      await ref.remove();
    } catch (error) {
      Log(
        LogType.ERROR,
        FirebaseDatabaseService.name,
        this.deleteRecord.name,
        LogAction.FAILED,
        { error, path, id },
      );
      throw error;
    }
  }
}
