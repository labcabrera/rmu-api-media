import { Page } from '../../../shared/application/pagination/page';
import { BaseRepository } from '../../../shared/application/ports/base-repository.port';
import { Image } from '../../domain/aggregates/image';
import type { ImageCategory } from '../../domain/entities/image-category';

export interface ImageRepository extends BaseRepository<Image> {
  findByCategory(category: ImageCategory, page: number, size: number): Promise<Page<Image>>;
  findByStorageKey(storageKey: string): Promise<Image | null>;
}

export const IMAGE_REPOSITORY = Symbol('ImageRepository');
