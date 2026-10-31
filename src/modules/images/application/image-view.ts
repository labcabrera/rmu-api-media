import type { Image } from '../domain/aggregates/image.js';
import type { BaseImage } from '../domain/entities/base-image.js';

/** What the queries return: an uploaded image (`source: 'user'`) or a base image of rmu-mfe-assets (`'base'`). */
export type ImageView = Image | BaseImage;
