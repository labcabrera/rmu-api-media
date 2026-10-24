import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { type ImageImportTaskRepository, IMAGE_IMPORT_TASK_REPOSITORY } from '../../ports/image-import-task-repository.port.js';
import { ImageImportTask } from '../../../domain/aggregates/image-import-task.js';
import { GetImageImportTaskQuery } from '../queries/get-image-import-task.query.js';
import { NotFoundError } from '../../../../shared/domain/errors/errors.js';

@QueryHandler(GetImageImportTaskQuery)
export class GetImageImportTaskHandler implements IQueryHandler<GetImageImportTaskQuery, ImageImportTask> {
  constructor(@Inject(IMAGE_IMPORT_TASK_REPOSITORY) private readonly taskRepository: ImageImportTaskRepository) {}

  async execute(query: GetImageImportTaskQuery): Promise<ImageImportTask> {
    const task = await this.taskRepository.findById(query.id);
    if (!task) throw new NotFoundError('Image import task', query.id);
    return task;
  }
}
