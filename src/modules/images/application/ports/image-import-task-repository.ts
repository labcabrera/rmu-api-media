import { BaseRepository } from '../../../shared/application/ports/base-repository';
import { ImageImportTask } from '../../domain/aggregates/image-import-task';

export type ImageImportTaskRepository = BaseRepository<ImageImportTask>;
