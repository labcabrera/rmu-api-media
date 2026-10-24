import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Image } from '../../../domain/aggregates/image.js';
import { UploadImageCommand } from '../commands/upload-image.command.js';
import { IMAGE_GUARD, type ImageGuardPort } from '../../ports/image-guard.port.js';
import { type ImageRepository, IMAGE_REPOSITORY } from '../../ports/image-repository.port.js';
import { type ImageStoragePort, IMAGE_STORAGE_PORT } from '../../ports/image-storage.port.js';

@CommandHandler(UploadImageCommand)
export class UploadImageHandler implements ICommandHandler<UploadImageCommand, Image> {
  private readonly logger = new Logger(UploadImageHandler.name);

  constructor(
    @Inject(IMAGE_REPOSITORY) private readonly imageRepository: ImageRepository,
    @Inject(IMAGE_STORAGE_PORT) private readonly imageStorage: ImageStoragePort,
    @Inject(IMAGE_GUARD) private readonly imageGuard: ImageGuardPort,
  ) {}

  async execute(command: UploadImageCommand): Promise<Image> {
    this.logger.log(`Uploading image in category ${command.category} for user ${command.userId}`);

    this.imageGuard.checkCreate(command.roles);

    const image = Image.create({
      category: command.category,
      storageKey: '',
      url: '',
      contentType: command.contentType,
      sizeBytes: command.content.length,
      originalFilename: command.originalFilename,
      altText: command.altText,
      metadata: command.metadata,
      verified: false,
      owner: command.userId,
    });

    const stored = await this.imageStorage.store({
      imageId: image.id,
      category: image.category,
      content: command.content,
      contentType: command.contentType,
      originalFilename: command.originalFilename,
    });

    image.updateContent({
      storageKey: stored.storageKey,
      url: stored.url,
      contentType: stored.contentType,
      sizeBytes: stored.sizeBytes,
      width: stored.width,
      height: stored.height,
      originalFilename: command.originalFilename,
    });

    return await this.imageRepository.save(image);
  }
}
