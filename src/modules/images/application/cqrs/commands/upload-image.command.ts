import { AuthenticatedCommand } from 'src/modules/shared/application/cqrs/authenticated-command';
import type { ImageCategory } from '../../../domain/entities/image-category';

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
  ) {
    super(userId, roles);
  }
}
