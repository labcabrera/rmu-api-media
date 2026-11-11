import type { BaseImage } from '../../domain/entities/base-image.js';

/**
 * The base images of rmu-mfe-assets (spec 057, decision 2), read from its manifest instead of stored here. When the
 * manifest cannot be loaded, the catalog keeps the last copy it read, or has no images if it never read one.
 */
export interface BaseImageCatalogPort {
  /** The base images that match an RSQL expression over the fields of ImageDto, sorted by path. */
  search(rsql: string | undefined): Promise<BaseImage[]>;
  /** The base image of a path (`images/races/x.png`), or null. */
  findByPath(path: string): Promise<BaseImage | null>;
}

export const BASE_IMAGE_CATALOG = Symbol('BaseImageCatalogPort');
