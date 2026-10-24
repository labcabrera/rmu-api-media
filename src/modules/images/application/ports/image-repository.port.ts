import { Page } from '../../../shared/application/pagination/page.js';
import type { BaseRepository } from '../../../shared/application/ports/base-repository.port.js';
import { Image } from '../../domain/aggregates/image.js';
import type { ImageCategory } from '../../domain/entities/image-category.js';

export interface ImageRepository extends BaseRepository<Image> {
  findByCategory(category: ImageCategory, page: number, size: number): Promise<Page<Image>>;
  findByStorageKey(storageKey: string): Promise<Image | null>;
}

export const IMAGE_REPOSITORY = Symbol('ImageRepository');
