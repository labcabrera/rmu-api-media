import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DeleteImageCommand } from '../commands/delete-image.command.js';
import { IMAGE_GUARD, type ImageGuardPort } from '../../ports/image-guard.port.js';
import { type ImageRepository, IMAGE_REPOSITORY } from '../../ports/image-repository.port.js';
import { type ImageStoragePort, IMAGE_STORAGE_PORT } from '../../ports/image-storage.port.js';
import { NotFoundError } from '../../../../shared/domain/errors/errors.js';
import { isBaseImageId } from '../../../domain/entities/base-image.js';
import { BaseImageReadOnlyError } from '../../../domain/errors/base-image-read-only.error.js';

@CommandHandler(DeleteImageCommand)
export class DeleteImageHandler implements ICommandHandler<DeleteImageCommand> {
  private readonly logger = new Logger(DeleteImageHandler.name);

  constructor(
    @Inject(IMAGE_REPOSITORY) private readonly imageRepository: ImageRepository,
    @Inject(IMAGE_STORAGE_PORT) private readonly imageStorage: ImageStoragePort,
    @Inject(IMAGE_GUARD) private readonly imageGuard: ImageGuardPort,
  ) {}

  async execute(command: DeleteImageCommand): Promise<void> {
    this.logger.log(`Deleting image ${command.id} for user ${command.userId}`);

    if (isBaseImageId(command.id)) throw new BaseImageReadOnlyError(command.id);
    const image = await this.imageRepository.findById(command.id);
    if (!image) throw new NotFoundError('Image', command.id);
    this.imageGuard.checkDelete(image, command.userId, command.roles);

    const deleted = await this.imageRepository.deleteById(command.id);
    if (!deleted) throw new NotFoundError('Image', command.id);

    await this.imageStorage.delete(image.storageKey);
  }
}
