export enum FirebasePathsEnum {
  LOCKS = 'LOCKS',
  IMAGES = 'IMAGES',
}

export interface IFirebaseListenForNewRecords {
  path: FirebasePathsEnum;
  callback: (data: any, key: string) => Promise<void>;
}
