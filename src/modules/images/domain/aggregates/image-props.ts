import type { ImageCategory } from '../entities/image-category.js';
import type { ImageVisibility } from '../entities/image-visibility.js';

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
  visibility: ImageVisibility;
  owner: string;
  createdAt: Date;
  updatedAt?: Date;
}
