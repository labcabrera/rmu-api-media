import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Image } from '../../../domain/aggregates/image';
import { UploadImageCommand } from '../commands/upload-image.command';
import type { ImageRepository } from '../../ports/image-repository';
import type { ImageStoragePort } from '../../ports/image-storage.port';

@CommandHandler(UploadImageCommand)
export class UploadImageHandler implements ICommandHandler<UploadImageCommand, Image> {
  private readonly logger = new Logger(UploadImageHandler.name);

  constructor(
    @Inject('ImageRepository') private readonly imageRepository: ImageRepository,
    @Inject('ImageStoragePort') private readonly imageStorage: ImageStoragePort,
  ) {}

  async execute(command: UploadImageCommand): Promise<Image> {
    this.logger.log(`Uploading image in category ${command.category} for user ${command.userId}`);

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
