import type { Image } from '../../domain/aggregates/image.js';
import type { ImageImportTask } from '../../domain/aggregates/image-import-task.js';

export const IMAGE_GUARD = Symbol('ImageGuardPort');

/**
 * Who may do what with images (spec 021, decision 2). Images have no accessType: any authenticated user reads them,
 * as the MFEs show them to everyone.
 */
export interface ImageGuardPort {
  /** Upload: rmu-user or rmu-admin. */
  checkCreate(roles: string[]): void;
  /** Change: the owner or rmu-admin. */
  checkUpdate(image: Image, userId: string, roles: string[]): void;
  /** Delete: the owner or rmu-admin. */
  checkDelete(image: Image, userId: string, roles: string[]): void;
  /** Import a whole S3 folder: rmu-admin only. */
  checkImport(roles: string[]): void;
  /** Read an import task: the user that started it or rmu-admin. */
  checkReadTask(task: ImageImportTask, userId: string, roles: string[]): void;
}
