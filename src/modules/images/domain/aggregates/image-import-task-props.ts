export type ImageImportTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ImageImportTaskError {
  storageKey?: string;
  message: string;
}

export interface ImageImportTaskProps {
  id: string;
  folder: string;
  status: ImageImportTaskStatus;
  totalObjects: number;
  processedObjects: number;
  importedImageIds: string[];
  verifiedImageIds: string[];
  skipped: string[];
  errors: ImageImportTaskError[];
  message: string;
  owner: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  updatedAt?: Date;
}
