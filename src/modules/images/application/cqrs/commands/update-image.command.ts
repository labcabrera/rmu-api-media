import { AuthenticatedCommand } from 'src/modules/shared/application/cqrs/authenticated-command';
import type { ImageCategory } from '../../../domain/entities/image-category';

export class UpdateImageCommand extends AuthenticatedCommand {
  constructor(
    public readonly id: string,
    public readonly category: ImageCategory | undefined,
    public readonly content: Buffer | undefined,
    public readonly contentType: string | undefined,
    public readonly originalFilename: string | undefined,
    public readonly altText: string | undefined,
    public readonly metadata: Record<string, string> | undefined,
    userId: string,
    roles: string[],
  ) {
    super(userId, roles);
  }
}
