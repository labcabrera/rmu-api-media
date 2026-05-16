import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Image } from '../../../domain/aggregates/image';
import { UpdateImageCommand } from '../commands/update-image.command';
import type { ImageRepository } from '../../ports/image-repository';
import type { ImageStoragePort } from '../../ports/image-storage.port';
import { NotFoundError } from 'src/modules/shared/domain/errors/errors';

@CommandHandler(UpdateImageCommand)
export class UpdateImageHandler implements ICommandHandler<UpdateImageCommand, Image> {
  private readonly logger = new Logger(UpdateImageHandler.name);

  constructor(
    @Inject('ImageRepository') private readonly imageRepository: ImageRepository,
    @Inject('ImageStoragePort') private readonly imageStorage: ImageStoragePort,
  ) {}

  async execute(command: UpdateImageCommand): Promise<Image> {
    this.logger.log(`Updating image ${command.id} for user ${command.userId}`);

    const image = await this.imageRepository.findById(command.id);
    if (!image) throw new NotFoundError('Image', command.id);

    image.updateMetadata({
      category: command.category,
      altText: command.altText,
      metadata: command.metadata,
    });

    if (command.content && command.contentType) {
      const previousStorageKey = image.storageKey;
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

      if (previousStorageKey && previousStorageKey !== stored.storageKey) await this.imageStorage.delete(previousStorageKey);
    }

    return await this.imageRepository.update(image.id, image);
  }
}
