import type { ImageCategory } from '../../domain/entities/image-category';

export interface StoreImageInput {
  imageId: string;
  category: ImageCategory;
  content: Buffer;
  contentType: string;
  originalFilename?: string;
}

export interface StoredImage {
  storageKey: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
}

export interface StoredImageObject {
  storageKey: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  lastModified?: Date;
}

export interface ImageStoragePort {
  store(input: StoreImageInput): Promise<StoredImage>;
  list(prefix: string): Promise<StoredImageObject[]>;
  delete(storageKey: string): Promise<void>;
}
