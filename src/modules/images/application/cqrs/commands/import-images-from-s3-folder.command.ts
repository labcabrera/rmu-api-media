import { AuthenticatedCommand } from 'src/modules/shared/application/cqrs/authenticated-command';

export class ImportImagesCommand extends AuthenticatedCommand {
  constructor(
    public readonly folder: string,
    public readonly metadata: Record<string, string> | undefined,
    userId: string,
    roles: string[],
  ) {
    super(userId, roles);
  }
}
