import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';
import type { ImageImportTaskError, ImageImportTaskStatus } from '../../../domain/aggregates/image-import-task-props.js';

export type ImageImportTaskDocument = HydratedDocument<ImageImportTaskModel>;

@Schema({ collection: 'image_import_tasks', versionKey: false })
export class ImageImportTaskModel {
  @Prop({ required: true })
  _id: string;

  @Prop({ required: true, index: true })
  folder: string;

  @Prop({ type: String, required: true, index: true })
  status: ImageImportTaskStatus;

  @Prop({ required: true, default: 0 })
  totalObjects: number;

  @Prop({ required: true, default: 0 })
  processedObjects: number;

  @Prop({ type: [String], required: true, default: [] })
  importedImageIds: string[];

  @Prop({ type: [String], required: true, default: [] })
  verifiedImageIds: string[];

  @Prop({ type: [String], required: true, default: [] })
  skipped: string[];

  @Prop({ type: [Object], required: true, default: [] })
  errors: ImageImportTaskError[];

  @Prop({ required: true })
  message: string;

  @Prop({ required: true, index: true })
  owner: string;

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: false })
  startedAt?: Date;

  @Prop({ required: false })
  completedAt?: Date;

  @Prop({ required: false })
  updatedAt?: Date;
}

export const ImageImportTaskSchema = SchemaFactory.createForClass(ImageImportTaskModel);
