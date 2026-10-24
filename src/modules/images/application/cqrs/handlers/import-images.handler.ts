import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ImportImagesCommand } from '../commands/import-images-from-s3-folder.command.js';
import { IMAGE_GUARD, type ImageGuardPort } from '../../ports/image-guard.port.js';
import { ImageImportTask } from '../../../domain/aggregates/image-import-task.js';
import { type ImageImportTaskRepository, IMAGE_IMPORT_TASK_REPOSITORY } from '../../ports/image-import-task-repository.port.js';
import { ImageImportTaskProcessor } from '../../services/image-import-task.processor.js';

export interface ImportImagesResult {
  taskId: string;
  message: string;
}

@CommandHandler(ImportImagesCommand)
export class ImportImagesHandler implements ICommandHandler<ImportImagesCommand, ImportImagesResult> {
  private readonly logger = new Logger(ImportImagesHandler.name);

  constructor(
    @Inject(IMAGE_IMPORT_TASK_REPOSITORY) private readonly taskRepository: ImageImportTaskRepository,
    @Inject(IMAGE_GUARD) private readonly imageGuard: ImageGuardPort,
    private readonly taskProcessor: ImageImportTaskProcessor,
  ) {}

  async execute(command: ImportImagesCommand): Promise<ImportImagesResult> {
    this.imageGuard.checkImport(command.roles);
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
