import type { BaseRepository } from '../../../shared/application/ports/base-repository.port.js';
import { Image } from '../../domain/aggregates/image.js';

/** A window of a search: the images from `skip` on, and how many match in all. */
export interface ImageSlice {
  content: Image[];
  totalElements: number;
}

export interface ImageRepository extends BaseRepository<Image> {
  /**
   * The user images that match an RSQL expression, sorted by id, from `skip` on and at most `limit` of them (0 only
   * counts). The expression may filter on `source` (always `user` here) like any field of ImageDto.
   */
  findSlice(rsql: string | undefined, skip: number, limit: number): Promise<ImageSlice>;
}

export const IMAGE_REPOSITORY = Symbol('ImageRepository');
