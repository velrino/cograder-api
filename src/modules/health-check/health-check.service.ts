import { DateTime } from 'luxon';
import { Injectable } from '@nestjs/common';

import {
  HealthCheckServiceName,
  HealthCheckStatus,
  IHealthCheckResult,
} from './health-check.interface';
import { CalculateTimeBetweenDates } from 'src/shared/lib/calculate-time-between-dates';
import { GetEnvironment } from 'src/shared/general/enviroment';

import { FirebaseService } from 'src/shared/google/firebase/firebase.service';
import { QueueService } from 'src/shared/queue/queue.service';

@Injectable()
export class HealthCheckService {
  constructor(
    private readonly queueService: QueueService,
    private readonly firebaseService: FirebaseService,
  ) {}

  async execute() {
    const start = Date.now();

    const result: IHealthCheckResult[] = [
      await this.checkRedis(),
      await this.checkFirebase(),
    ];
    const resultIsCache: boolean = false;

    const overallResponseTime = Date.now() - start;

    return {
      environment: GetEnvironment(),
      time: this.calculateTimeBetweenDates(),
      result_total_time: `${overallResponseTime}ms`,
      result_is_cache: resultIsCache,
      result,
    };
  }

  private calculateTimeBetweenDates() {
    const lastDeploy = process.env.LAST_DEPLOY
      ? DateTime.fromISO(process.env.LAST_DEPLOY)
      : DateTime.now();

    const now = DateTime.now();

    return CalculateTimeBetweenDates(lastDeploy, now);
  }

  private async checkService(
    serviceName: HealthCheckServiceName,
    serviceCheck: () => Promise<any>,
  ): Promise<IHealthCheckResult> {
    const start = Date.now();

    // Timeout wrapper
    const withTimeout = (promise: Promise<any>, ms: number) => {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(
          () => reject(new Error('TIMEOUT_EXCEEDED')),
          ms,
        );
        promise
          .then((value) => {
            clearTimeout(timeoutId);
            resolve(value);
          })
          .catch((error) => {
            clearTimeout(timeoutId);
            reject(error instanceof Error ? error : new Error(String(error)));
          });
      });
    };

    try {
      await withTimeout(serviceCheck(), 3000); // 3-second timeout
      const responseTime = Date.now() - start;
      return {
        [serviceName]: {
          status: HealthCheckStatus.UP,
          response_time: `${responseTime}ms`,
        },
      };
    } catch (error) {
      const responseTime = Date.now() - start;
      return {
        [serviceName]: {
          status: HealthCheckStatus.DOWN,
          response_time: `${responseTime}ms`,
          message: error.message,
        },
      };
    }
  }

  private async checkRedis(): Promise<IHealthCheckResult> {
    return this.checkService(HealthCheckServiceName.REDIS, async () => {
      const isConnected = await this.queueService.ping();
      if (!isConnected) {
        throw new Error('REDIS_PING_FAILED');
      }
      return isConnected;
    });
  }

  private async checkFirebase(): Promise<IHealthCheckResult> {
    return this.checkService(HealthCheckServiceName.FIREBASE, async () => {
      const isConnected = await this.firebaseService.ping();
      if (!isConnected) {
        throw new Error('FIREBASE_NOT_CONNECTED');
      }
      return isConnected;
    });
  }
}
