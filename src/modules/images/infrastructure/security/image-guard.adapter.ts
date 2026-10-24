import type { ImageGuardPort } from '../../application/ports/image-guard.port.js';
import type { Image } from '../../domain/aggregates/image.js';
import type { ImageImportTask } from '../../domain/aggregates/image-import-task.js';
import { BaseEntityGuard } from '../../../shared/infrastructure/security/base-entity-guard.js';
import type { RbacEntity } from '../../../shared/domain/entities/rbac-entity.js';
import { RMU_ADMIN } from '../../../shared/domain/entities/user-roles.js';
import { ForbiddenError } from '../../../shared/domain/errors/errors.js';

/** The common rules of BaseEntityGuard, on the owner of the image (every image is public) or of the task (private). */
export class ImageGuardAdapter extends BaseEntityGuard<RbacEntity> implements ImageGuardPort {
  checkUpdate(image: Image | RbacEntity, userId: string, roles: string[]) {
    super.checkUpdate({ owner: image.owner, accessType: 'public' }, userId, roles);
  }

  checkDelete(image: Image | RbacEntity, userId: string, roles: string[]) {
    super.checkDelete({ owner: image.owner, accessType: 'public' }, userId, roles);
  }

  checkImport(roles: string[]) {
    if (roles.includes(RMU_ADMIN)) return;
    throw new ForbiddenError('Only an administrator can import images');
  }

  checkReadTask(task: ImageImportTask, userId: string, roles: string[]) {
    this.checkRead({ owner: task.owner, accessType: 'private' }, userId, roles);
  }
}
