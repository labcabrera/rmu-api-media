import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteImageCommand } from '../commands/delete-image.command';
import type { ImageRepository } from '../../ports/image-repository';
import type { ImageStoragePort } from '../../ports/image-storage.port';
import { NotFoundError } from 'src/modules/shared/domain/errors/errors';

@CommandHandler(DeleteImageCommand)
export class DeleteImageHandler implements ICommandHandler<DeleteImageCommand> {
  private readonly logger = new Logger(DeleteImageHandler.name);

  constructor(
    @Inject('ImageRepository') private readonly imageRepository: ImageRepository,
    @Inject('ImageStoragePort') private readonly imageStorage: ImageStoragePort,
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
