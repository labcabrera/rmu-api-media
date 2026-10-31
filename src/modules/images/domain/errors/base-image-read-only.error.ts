import { ForbiddenError } from '../../../shared/domain/errors/errors.js';

/** A base image belongs to rmu-mfe-assets: the API cannot change or delete it (spec 057, decision 2). */
export class BaseImageReadOnlyError extends ForbiddenError {
  constructor(id: string) {
    super(`Image ${id} is a base image of rmu-mfe-assets and cannot be changed or deleted`, 'base-image-read-only');
    this.name = 'BaseImageReadOnlyError';
    Object.setPrototypeOf(this, BaseImageReadOnlyError.prototype);
  }
}
