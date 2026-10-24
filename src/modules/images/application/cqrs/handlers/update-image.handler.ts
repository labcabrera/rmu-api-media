import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Image } from '../../../domain/aggregates/image.js';
import { UpdateImageCommand } from '../commands/update-image.command.js';
import { IMAGE_GUARD, type ImageGuardPort } from '../../ports/image-guard.port.js';
import { type ImageRepository, IMAGE_REPOSITORY } from '../../ports/image-repository.port.js';
import { type ImageStoragePort, IMAGE_STORAGE_PORT } from '../../ports/image-storage.port.js';
import { NotFoundError } from '../../../../shared/domain/errors/errors.js';

@CommandHandler(UpdateImageCommand)
export class UpdateImageHandler implements ICommandHandler<UpdateImageCommand, Image> {
  private readonly logger = new Logger(UpdateImageHandler.name);

  constructor(
    @Inject(IMAGE_REPOSITORY) private readonly imageRepository: ImageRepository,
    @Inject(IMAGE_STORAGE_PORT) private readonly imageStorage: ImageStoragePort,
    @Inject(IMAGE_GUARD) private readonly imageGuard: ImageGuardPort,
  ) {}

  async execute(command: UpdateImageCommand): Promise<Image> {
    this.logger.log(`Updating image ${command.id} for user ${command.userId}`);

    const image = await this.imageRepository.findById(command.id);
    if (!image) throw new NotFoundError('Image', command.id);
    this.imageGuard.checkUpdate(image, command.userId, command.roles);
    image.checkVersion(command.expectedVersion);

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

    // A PATCH that changes nothing does not write (spec 021, decision 9).
    if (!image.hasChanges()) return image;
    return await this.imageRepository.update(image);
  }
}
