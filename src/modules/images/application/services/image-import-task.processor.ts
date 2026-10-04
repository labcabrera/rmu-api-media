import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImageCategory } from 'src/modules/images/domain/entities/image-category';
import { Image } from '../../domain/aggregates/image';
import { ImageImportTask } from '../../domain/aggregates/image-import-task';
import type { ImageImportTaskRepository } from '../ports/image-import-task-repository';
import type { ImageRepository } from '../ports/image-repository';
import type { ImageStoragePort, StoredImageObject } from '../ports/image-storage.port';

export interface ProcessImageImportTaskInput {
  task: ImageImportTask;
  metadata: Record<string, string> | undefined;
  userId: string;
}

@Injectable()
export class ImageImportTaskProcessor {
  private readonly logger = new Logger(ImageImportTaskProcessor.name);

  constructor(
    @Inject('ImageRepository') private readonly imageRepository: ImageRepository,
    @Inject('ImageImportTaskRepository') private readonly taskRepository: ImageImportTaskRepository,
    @Inject('ImageStoragePort') private readonly imageStorage: ImageStoragePort,
    private readonly configService: ConfigService,
  ) {}

  async process(input: ProcessImageImportTaskInput): Promise<void> {
    const task = input.task;

    try {
      const objects = await this.imageStorage.list(task.folder);
      task.start(objects.length);
      await this.taskRepository.update(task.id, task);

      const batchSize = this.getPositiveConfig('RMU_MEDIA_IMAGE_IMPORT_BATCH_SIZE', 50);
      const parallelism = this.getPositiveConfig('RMU_MEDIA_IMAGE_IMPORT_PARALLELISM', 4);

      this.logger.log(
        `Import task ${task.id} found ${objects.length} objects. Running with parallelism=${parallelism}, batchSize=${batchSize}`,
      );

      for (let index = 0; index < objects.length; index += batchSize) {
        const batch = objects.slice(index, index + batchSize);
        await this.processBatch(batch, task, input.metadata, input.userId, parallelism);
        await this.taskRepository.update(task.id, task);
      }

      task.complete();
      await this.taskRepository.update(task.id, task);
    } catch (error) {
      const message = `Image import error: ${(error as Error).message}`;
      this.logger.error(message, (error as Error).stack);
      task.fail(message);
      await this.taskRepository.update(task.id, task);
    }
  }

  private async processBatch(
    batch: StoredImageObject[],
    task: ImageImportTask,
    metadata: Record<string, string> | undefined,
    userId: string,
    parallelism: number,
  ) {
    let nextIndex = 0;
    const workerCount = Math.min(parallelism, batch.length);

    await Promise.all(
      Array.from({ length: workerCount }, async () => {
        while (nextIndex < batch.length) {
          const object = batch[nextIndex++];
          await this.processObject(object, task, metadata, userId);
        }
      }),
    );
  }

  private async processObject(
    object: StoredImageObject,
    task: ImageImportTask,
    metadata: Record<string, string> | undefined,
    userId: string,
  ) {
    try {
      if (!this.isImage(object)) {
        task.addSkipped(object.storageKey);
        return;
      }

      const current = await this.imageRepository.findByStorageKey(object.storageKey);
      if (current) {
        current.markVerified();
        const updated = await this.imageRepository.update(current.id, current);
        task.addVerified(updated.id);
        return;
      }

      const image = Image.create({
        category: object.storageKey.split('/').slice(-2, -1)[0] as ImageCategory,
        storageKey: object.storageKey,
        url: object.url,
        contentType: object.contentType,
        sizeBytes: object.sizeBytes,
        originalFilename: this.getOriginalFilename(object.storageKey),
        metadata: {
          ...(metadata ?? {}),
          importedFrom: 's3',
          importedFolder: task.folder,
        },
        verified: true,
        owner: userId,
      });

      const imported = await this.imageRepository.save(image);
      task.addImported(imported.id);
    } catch (error) {
      this.logger.warn(`Could not import image object ${object.storageKey}: ${(error as Error).message}`);
      task.addError({ storageKey: object.storageKey, message: (error as Error).message });
    }
  }

  private isImage(object: StoredImageObject) {
    return object.contentType.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(object.storageKey);
  }

  private getOriginalFilename(storageKey: string) {
    const parts = storageKey.split('/').filter(Boolean);
    return parts.at(-1);
  }

  private getPositiveConfig(key: string, defaultValue: number) {
    const value = this.configService.get<number>(key) ?? defaultValue;
    return Number.isInteger(value) && value > 0 ? value : defaultValue;
  }
}
