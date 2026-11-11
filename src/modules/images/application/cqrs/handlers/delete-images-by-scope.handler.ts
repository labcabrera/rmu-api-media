import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DeleteImagesByScopeCommand } from '../commands/delete-images-by-scope.command.js';
import { IMAGE_GUARD, type ImageGuardPort } from '../../ports/image-guard.port.js';
import { type ImageRepository, IMAGE_REPOSITORY } from '../../ports/image-repository.port.js';
import { type ImageStoragePort, IMAGE_STORAGE_PORT } from '../../ports/image-storage.port.js';
import { parseImageScope } from '../../../domain/entities/image-scope.js';

/** How many images of the scope were deleted. */
export interface DeleteImagesByScopeResult {
  deleted: number;
}

@CommandHandler(DeleteImagesByScopeCommand)
export class DeleteImagesByScopeHandler implements ICommandHandler<DeleteImagesByScopeCommand, DeleteImagesByScopeResult> {
  private readonly logger = new Logger(DeleteImagesByScopeHandler.name);

  constructor(
    @Inject(IMAGE_REPOSITORY) private readonly imageRepository: ImageRepository,
    @Inject(IMAGE_STORAGE_PORT) private readonly imageStorage: ImageStoragePort,
    @Inject(IMAGE_GUARD) private readonly imageGuard: ImageGuardPort,
  ) {}

  async execute(command: DeleteImagesByScopeCommand): Promise<DeleteImagesByScopeResult> {
    this.imageGuard.checkDeleteByScope(command.roles);
    const scope = parseImageScope(command.scope);
    this.logger.log(`Deleting the images of scope ${scope} for user ${command.userId}`);

    const images = await this.imageRepository.findAllByScope(scope);
    if (images.length === 0) return { deleted: 0 };
    // Only the documents read are deleted: an image uploaded meanwhile keeps both its document and its object.
    const deleted = await this.imageRepository.deleteByIds(images.map(image => image.id));
    // The storage adapter logs and ignores an object it cannot delete, as the single delete does.
    for (const image of images) await this.imageStorage.delete(image.storageKey);
    return { deleted };
  }
}
