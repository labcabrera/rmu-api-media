import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DeleteImageCommand } from '../commands/delete-image.command.js';
import { type ImageRepository, IMAGE_REPOSITORY } from '../../ports/image-repository.port.js';
import { type ImageStoragePort, IMAGE_STORAGE_PORT } from '../../ports/image-storage.port.js';
import { NotFoundError } from '../../../../shared/domain/errors/errors.js';

@CommandHandler(DeleteImageCommand)
export class DeleteImageHandler implements ICommandHandler<DeleteImageCommand> {
  private readonly logger = new Logger(DeleteImageHandler.name);

  constructor(
    @Inject(IMAGE_REPOSITORY) private readonly imageRepository: ImageRepository,
    @Inject(IMAGE_STORAGE_PORT) private readonly imageStorage: ImageStoragePort,
  ) {}

  async execute(command: DeleteImageCommand): Promise<void> {
    this.logger.log(`Deleting image ${command.id} for user ${command.userId}`);

    const image = await this.imageRepository.findById(command.id);
    if (!image) throw new NotFoundError('Image', command.id);

    const deleted = await this.imageRepository.deleteById(command.id);
    if (!deleted) throw new NotFoundError('Image', command.id);

    await this.imageStorage.delete(image.storageKey);
  }
}
