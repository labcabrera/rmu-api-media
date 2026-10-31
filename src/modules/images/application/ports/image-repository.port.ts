import type { BaseRepository } from '../../../shared/application/ports/base-repository.port.js';
import { Image } from '../../domain/aggregates/image.js';

export type ImageRepository = BaseRepository<Image>;

export const IMAGE_REPOSITORY = Symbol('ImageRepository');
