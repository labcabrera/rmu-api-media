import { BaseRepository } from '../../../shared/application/ports/base-repository.port';
import { ImageImportTask } from '../../domain/aggregates/image-import-task';

export type ImageImportTaskRepository = BaseRepository<ImageImportTask>;

export const IMAGE_IMPORT_TASK_REPOSITORY = Symbol('ImageImportTaskRepository');
