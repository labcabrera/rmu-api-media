import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Image } from '../../../domain/aggregates/image';
import { ImportImagesFromS3FolderCommand } from '../commands/import-images-from-s3-folder.command';
import type { ImageRepository } from '../../ports/image-repository';
import type { ImageStoragePort, StoredImageObject } from '../../ports/image-storage.port';

export interface ImportImagesFromS3FolderResult {
  imported: Image[];
  skipped: string[];
}

@CommandHandler(ImportImagesFromS3FolderCommand)
export class ImportImagesFromS3FolderHandler implements ICommandHandler<ImportImagesFromS3FolderCommand, ImportImagesFromS3FolderResult> {
  private readonly logger = new Logger(ImportImagesFromS3FolderHandler.name);

  constructor(
    @Inject('ImageRepository') private readonly imageRepository: ImageRepository,
    @Inject('ImageStoragePort') private readonly imageStorage: ImageStoragePort,
  ) {}

  async execute(command: ImportImagesFromS3FolderCommand): Promise<ImportImagesFromS3FolderResult> {
    this.logger.log(`Importing S3 images from folder ${command.folder} for user ${command.userId}`);

    const objects = await this.imageStorage.list(command.folder);
    const imported: Image[] = [];
    const skipped: string[] = [];

    for (const object of objects) {
      if (!this.isImage(object)) {
        skipped.push(object.storageKey);
        continue;
      }

      const current = await this.imageRepository.findByStorageKey(object.storageKey);
      if (current) {
        skipped.push(object.storageKey);
        continue;
      }

      const image = Image.create({
        category: command.category,
        storageKey: object.storageKey,
        url: object.url,
        contentType: object.contentType,
        sizeBytes: object.sizeBytes,
        originalFilename: this.getOriginalFilename(object.storageKey),
        metadata: {
          ...(command.metadata ?? {}),
          importedFrom: 's3',
          importedFolder: command.folder,
        },
        owner: command.userId,
      });

      imported.push(await this.imageRepository.save(image));
    }

    return { imported, skipped };
  }

  private isImage(object: StoredImageObject) {
    return object.contentType.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(object.storageKey);
  }

  private getOriginalFilename(storageKey: string) {
    const parts = storageKey.split('/').filter(Boolean);
    return parts.at(-1);
  }
}
