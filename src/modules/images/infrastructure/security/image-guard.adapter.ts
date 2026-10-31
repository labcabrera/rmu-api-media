import type { ImageGuardPort } from '../../application/ports/image-guard.port.js';
import type { Image } from '../../domain/aggregates/image.js';
import { BaseEntityGuard } from '../../../shared/infrastructure/security/base-entity-guard.js';
import type { RbacEntity } from '../../../shared/domain/entities/rbac-entity.js';

/** The common rules of BaseEntityGuard, on the owner of the image (every image is public). */
export class ImageGuardAdapter extends BaseEntityGuard<RbacEntity> implements ImageGuardPort {
  checkUpdate(image: Image | RbacEntity, userId: string, roles: string[]) {
    super.checkUpdate({ owner: image.owner, accessType: 'public' }, userId, roles);
  }

  checkDelete(image: Image | RbacEntity, userId: string, roles: string[]) {
    super.checkDelete({ owner: image.owner, accessType: 'public' }, userId, roles);
  }
}
