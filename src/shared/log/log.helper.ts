export enum LogType {
  INFO = 'info',
  LOG = 'log',
  ERROR = 'error',
}

export enum LogAction {
  SUCCESS = 'success',
  STARTED = 'started',
  FINISHED = 'finished',
  EMPTY = 'empty',
  SKIP = 'skip',
  FAILED = 'failed',
  PROGRESS = 'progress',
  JOB_STARTED = 'JOB_STARTED',
  JOB_PROGRESS = 'JOB_PROGRESS',
  JOB_FINISHED = 'JOB_FINISHED',
}

export function Log(
  type: LogType,
  name: string,
  event: string,
  action: string,
  parameters: any,
) {
  console[type](`${type.toUpperCase()}.${name}.${event}.${action}`, parameters);
}
