import type { BaseRepository } from '../../../shared/application/ports/base-repository.port.js';
import { ImageImportTask } from '../../domain/aggregates/image-import-task.js';

export type ImageImportTaskRepository = BaseRepository<ImageImportTask>;

export const IMAGE_IMPORT_TASK_REPOSITORY = Symbol('ImageImportTaskRepository');
