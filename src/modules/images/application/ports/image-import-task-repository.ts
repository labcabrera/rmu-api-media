import { BaseRepository } from 'src/modules/shared/application/ports/base-repository';
import { ImageImportTask } from '../../domain/aggregates/image-import-task';

export type ImageImportTaskRepository = BaseRepository<ImageImportTask>;
