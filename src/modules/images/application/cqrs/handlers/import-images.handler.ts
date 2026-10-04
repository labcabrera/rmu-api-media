import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ImportImagesCommand } from '../commands/import-images-from-s3-folder.command';
import { ImageImportTask } from '../../../domain/aggregates/image-import-task';
import type { ImageImportTaskRepository } from '../../ports/image-import-task-repository';
import { ImageImportTaskProcessor } from '../../services/image-import-task.processor';

export interface ImportImagesResult {
  taskId: string;
  message: string;
}

@CommandHandler(ImportImagesCommand)
export class ImportImagesHandler implements ICommandHandler<ImportImagesCommand, ImportImagesResult> {
  private readonly logger = new Logger(ImportImagesHandler.name);

  constructor(
    @Inject('ImageImportTaskRepository') private readonly taskRepository: ImageImportTaskRepository,
    private readonly taskProcessor: ImageImportTaskProcessor,
  ) {}

  async execute(command: ImportImagesCommand): Promise<ImportImagesResult> {
    this.logger.log(`Scheduling S3 image import from folder ${command.folder} for user ${command.userId}`);

    const task = await this.taskRepository.save(
      ImageImportTask.create({
        folder: command.folder,
        owner: command.userId,
      }),
    );

    void this.taskProcessor.process({
      task,
      metadata: command.metadata,
      userId: command.userId,
    });

    return {
      taskId: task.id,
      message: 'Image import task scheduled successfully',
    };
  }
}
