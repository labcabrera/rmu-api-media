import { AuthenticatedCommand } from '../../../../shared/application/cqrs/authenticated-command.js';

/** Deletes every user image of a scope (spec 102, decision 5): what strategic asks when a campaign is deleted. */
export class DeleteImagesByScopeCommand extends AuthenticatedCommand {
  constructor(
    public readonly scope: string | undefined,
    userId: string,
    roles: string[],
  ) {
    super(userId, roles);
  }
}
