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

export interface ImageStoragePort {
  store(input: StoreImageInput): Promise<StoredImage>;
  delete(storageKey: string): Promise<void>;
}
