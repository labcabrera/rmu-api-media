import type { ImageCategory } from '../entities/image-category';

export interface ImageProps {
  id: string;
  category: ImageCategory;
  storageKey: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  originalFilename?: string;
  altText?: string;
  metadata?: Record<string, string>;
  verified: boolean;
  owner: string;
  createdAt: Date;
  updatedAt?: Date;
}
