import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import type { ImageCategory } from 'src/modules/images/domain/entities/image-category';

export type ImageDocument = ImageModel & Document;

@Schema({ collection: 'images', versionKey: false })
export class ImageModel {
  @Prop({ required: true })
  _id: string;

  @Prop({ required: true, index: true })
  category: ImageCategory;

  @Prop({ required: true })
  storageKey: string;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  contentType: string;

  @Prop({ required: true })
  sizeBytes: number;

  @Prop({ required: false })
  width?: number;

  @Prop({ required: false })
  height?: number;

  @Prop({ required: false })
  originalFilename?: string;

  @Prop({ required: false })
  altText?: string;

  @Prop({ type: Object, required: false })
  metadata?: Record<string, string>;

  @Prop({ required: true, index: true })
  owner: string;

  @Prop({ required: true })
  createdAt: Date;

  @Prop({ required: false })
  updatedAt?: Date;
}

export const ImageSchema = SchemaFactory.createForClass(ImageModel);
