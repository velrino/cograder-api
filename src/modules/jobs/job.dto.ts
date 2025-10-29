import { JobStatus } from './job.interface';

export class JobResponseDto {
  id: string;
  imageUrl: string;
  status: JobStatus;
  progress: number;
  resultUrl?: string;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}
