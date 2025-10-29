export enum FirebaseDatabasePath {
  LOCKS = 'LOCKS',
  IMAGES = 'IMAGES',
  JOBS = 'JOBS',
}

export interface IFirebaseDatabaseListenForNewRecords {
  path: FirebaseDatabasePath;
  callback: (data: any, key: string) => Promise<void>;
}
