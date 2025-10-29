export enum FirebaseDatabasePath {
  LOCKS = 'LOCKS',
  IMAGES = 'IMAGES',
}

export interface IFirebaseDatabaseListenForNewRecords {
  path: FirebaseDatabasePath;
  callback: (data: any, key: string) => Promise<void>;
}
