import { ValidationError } from '../../../shared/domain/errors/errors.js';

/** A scope that is missing or not `<kind>:<id>` with a known kind, `strategic-game:<uuid>` for now (spec 102). */
export class InvalidImageScopeError extends ValidationError {
  constructor(value: string | undefined | null) {
    super(
      value ? `Invalid image scope ${value}: expected strategic-game:<uuid>` : 'The image scope is required: strategic-game:<uuid>',
      'invalid-image-scope',
    );
    this.name = 'InvalidImageScopeError';
    Object.setPrototypeOf(this, InvalidImageScopeError.prototype);
  }
}
