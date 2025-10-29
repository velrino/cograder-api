export enum HealthCheckServiceName {
  REDIS = 'REDIS',
  FIREBASE = 'FIREBASE',
}

export enum HealthCheckStatus {
  UP = 'UP',
  DOWN = 'DOWN',
}

export interface IHealthCheck {
  cache: boolean;
}

export interface IHealthCheckResult {
  [key: string]: {
    status: HealthCheckStatus;
    response_time: string;
    message?: string;
  };
}
