import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { ImageImportTaskRepository } from '../../ports/image-import-task-repository';
import { ImageImportTask } from '../../../domain/aggregates/image-import-task';
import { GetImageImportTaskQuery } from '../queries/get-image-import-task.query';
import { NotFoundError } from 'src/modules/shared/domain/errors/errors';

@QueryHandler(GetImageImportTaskQuery)
export class GetImageImportTaskHandler implements IQueryHandler<GetImageImportTaskQuery, ImageImportTask> {
  constructor(@Inject('ImageImportTaskRepository') private readonly taskRepository: ImageImportTaskRepository) {}

  async execute(query: GetImageImportTaskQuery): Promise<ImageImportTask> {
    const task = await this.taskRepository.findById(query.id);
    if (!task) throw new NotFoundError('Image import task', query.id);
    return task;
  }
}
