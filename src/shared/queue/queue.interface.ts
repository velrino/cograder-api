export enum QueuesEnum {
  IMAGE_PROCESSING = 'IMAGE_PROCESSING',
}

export enum QueueStatus {
  FAILED = 'FAILED',
  COMPLETED = 'COMPLETED',
  STARTED = 'STARTED',
}

export interface IQueueWasJobProcessed {
  name: QueuesEnum;
  status?: QueueStatus;
}

export interface IQueueProcessJobParams {
  name: QueuesEnum;
  execute: (...args: any[]) => Promise<any>;
  params?: any[];
  secondsAgo?: number;
}
