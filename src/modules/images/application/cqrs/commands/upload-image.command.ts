import { AuthenticatedCommand } from '../../../../shared/application/cqrs/authenticated-command.js';
import type { ImageCategory } from '../../../domain/entities/image-category.js';
import { DEFAULT_IMAGE_VISIBILITY, type ImageVisibility } from '../../../domain/entities/image-visibility.js';

export class UploadImageCommand extends AuthenticatedCommand {
  constructor(
    public readonly category: ImageCategory,
    public readonly content: Buffer,
    public readonly contentType: string,
    public readonly originalFilename: string | undefined,
    public readonly altText: string | undefined,
    public readonly metadata: Record<string, string> | undefined,
    userId: string,
    roles: string[],
    public readonly visibility: ImageVisibility = DEFAULT_IMAGE_VISIBILITY,
  ) {
    super(userId, roles);
  }
}
