import type { ImageVisibility } from './image-visibility.js';

/** Prefix of the id of a base image: `base:images/races/generic-elf-01.png`. */
export const BASE_IMAGE_ID_PREFIX = 'base:';

export const isBaseImageId = (id: string) => id.startsWith(BASE_IMAGE_ID_PREFIX);

export interface BaseImageProps {
  /** Path relative to the root of rmu-mfe-assets, as the entities store it: `images/races/generic-elf-01.png`. */
  path: string;
  category: string;
  contentType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  sha256: string;
}

/**
 * An image of the rmu-mfe-assets repository, read from its manifest (spec 057, decision 2). It is not stored by this
 * API, so it is read-only: its id derives from its path and it has no owner and no version.
 */
export class BaseImage {
  readonly source = 'base' as const;
  readonly visibility: ImageVisibility = 'public';
  readonly verified = true;
  readonly owner = null;
  readonly version = 0;

  constructor(private readonly props: BaseImageProps) {}

  get id() {
    return `${BASE_IMAGE_ID_PREFIX}${this.props.path}`;
  }

  get path() {
    return this.props.path;
  }

  /** The url of a base image is its path, resolved by the frontends against RMU_MFE_ASSETS_URI. */
  get url() {
    return this.props.path;
  }

  get category() {
    return this.props.category;
  }

  get contentType() {
    return this.props.contentType;
  }

  get sizeBytes() {
    return this.props.sizeBytes;
  }

  get width() {
    return this.props.width;
  }

  get height() {
    return this.props.height;
  }

  get sha256() {
    return this.props.sha256;
  }

  /** The fields an RSQL search sees, named as in ImageDto. */
  toSearchRecord(): Record<string, unknown> {
    return {
      id: this.id,
      source: this.source,
      visibility: this.visibility,
      category: this.category,
      url: this.url,
      storageKey: this.path,
      path: this.path,
      contentType: this.contentType,
      sizeBytes: this.sizeBytes,
      width: this.width,
      height: this.height,
      sha256: this.sha256,
      verified: this.verified,
      owner: this.owner,
    };
  }
}
