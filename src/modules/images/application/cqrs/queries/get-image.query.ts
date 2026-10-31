import { AuthenticatedCommand } from '../../../../shared/application/cqrs/authenticated-command.js';

export class GetImageQuery extends AuthenticatedCommand {
  constructor(
    /** A user image id or a base image id (`base:<path>`). */
    public readonly id: string,
    userId: string,
    roles: string[],
  ) {
    super(userId, roles);
  }
}
