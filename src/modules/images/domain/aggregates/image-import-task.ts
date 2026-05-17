import { randomUUID } from 'crypto';
import { BaseAggregateRoot } from 'src/modules/shared/domain/aggregates/base-aggregate';
import type { ImageImportTaskError, ImageImportTaskProps, ImageImportTaskStatus } from './image-import-task-props';

export class ImageImportTask extends BaseAggregateRoot<ImageImportTaskProps> {
  public folder: string;
  public status: ImageImportTaskStatus;
  public totalObjects: number;
  public processedObjects: number;
  public importedImageIds: string[];
  public verifiedImageIds: string[];
  public skipped: string[];
  public errors: ImageImportTaskError[];
  public message: string;
  public owner: string;
  public createdAt: Date;
  public startedAt: Date | undefined;
  public completedAt: Date | undefined;
  public updatedAt: Date | undefined;

  private constructor(props: ImageImportTaskProps) {
    super(props.id);
    this.folder = props.folder;
    this.status = props.status;
    this.totalObjects = props.totalObjects;
    this.processedObjects = props.processedObjects;
    this.importedImageIds = props.importedImageIds;
    this.verifiedImageIds = props.verifiedImageIds;
    this.skipped = props.skipped;
    this.errors = props.errors;
    this.message = props.message;
    this.owner = props.owner;
    this.createdAt = props.createdAt;
    this.startedAt = props.startedAt;
    this.completedAt = props.completedAt;
    this.updatedAt = props.updatedAt;
  }

  static create(props: Pick<ImageImportTaskProps, 'folder' | 'owner'>) {
    return new ImageImportTask({
      id: randomUUID(),
      folder: props.folder,
      status: 'pending',
      totalObjects: 0,
      processedObjects: 0,
      importedImageIds: [],
      verifiedImageIds: [],
      skipped: [],
      errors: [],
      message: 'Image import is pending execution',
      owner: props.owner,
      createdAt: new Date(),
    });
  }

  static fromProps(props: ImageImportTaskProps) {
    return new ImageImportTask(props);
  }

  start(totalObjects: number) {
    this.status = 'running';
    this.totalObjects = totalObjects;
    this.message = 'Image import is running';
    this.startedAt = new Date();
    this.updatedAt = new Date();
  }

  addImported(imageId: string) {
    this.importedImageIds.push(imageId);
    this.processedObjects += 1;
    this.updatedAt = new Date();
  }

  addVerified(imageId: string) {
    this.verifiedImageIds.push(imageId);
    this.processedObjects += 1;
    this.updatedAt = new Date();
  }

  addSkipped(storageKey: string) {
    this.skipped.push(storageKey);
    this.processedObjects += 1;
    this.updatedAt = new Date();
  }

  addError(error: ImageImportTaskError) {
    this.errors.push(error);
    this.processedObjects += 1;
    this.updatedAt = new Date();
  }

  complete() {
    this.status = this.errors.length > 0 ? 'failed' : 'completed';
    this.message = this.status === 'completed' ? 'Image import completed successfully' : 'Image import completed with errors';
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  fail(message: string) {
    this.status = 'failed';
    this.message = message;
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  getProps(): ImageImportTaskProps {
    return {
      id: this.id,
      folder: this.folder,
      status: this.status,
      totalObjects: this.totalObjects,
      processedObjects: this.processedObjects,
      importedImageIds: this.importedImageIds,
      verifiedImageIds: this.verifiedImageIds,
      skipped: this.skipped,
      errors: this.errors,
      message: this.message,
      owner: this.owner,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      updatedAt: this.updatedAt,
    };
  }
}
