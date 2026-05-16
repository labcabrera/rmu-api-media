import { AuthenticatedCommand } from 'src/modules/shared/application/cqrs/authenticated-command';
import type { ImageCategory } from '../../../domain/entities/image-category';

export class ImportImagesFromS3FolderCommand extends AuthenticatedCommand {
  constructor(
    public readonly folder: string,
    public readonly category: ImageCategory,
    public readonly metadata: Record<string, string> | undefined,
    userId: string,
    roles: string[],
  ) {
    super(userId, roles);
  }
}
