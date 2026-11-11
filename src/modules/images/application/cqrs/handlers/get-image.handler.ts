import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundError } from '../../../../shared/domain/errors/errors.js';
import { BASE_IMAGE_ID_PREFIX, isBaseImageId } from '../../../domain/entities/base-image.js';
import type { ImageView } from '../../image-view.js';
import { BASE_IMAGE_CATALOG, type BaseImageCatalogPort } from '../../ports/base-image-catalog.port.js';
import { IMAGE_REPOSITORY, type ImageRepository } from '../../ports/image-repository.port.js';
import { GetImageQuery } from '../queries/get-image.query.js';

/** Any authenticated user reads any image (spec 021, decision 2). */
@QueryHandler(GetImageQuery)
export class GetImageHandler implements IQueryHandler<GetImageQuery, ImageView> {
  constructor(
    @Inject(IMAGE_REPOSITORY) private readonly imageRepository: ImageRepository,
    @Inject(BASE_IMAGE_CATALOG) private readonly baseImages: BaseImageCatalogPort,
  ) {}

  async execute(query: GetImageQuery): Promise<ImageView> {
    const image = isBaseImageId(query.id)
      ? await this.baseImages.findByPath(query.id.slice(BASE_IMAGE_ID_PREFIX.length))
      : await this.imageRepository.findById(query.id);
    if (!image) throw new NotFoundError('Image', query.id);
    return image;
  }
}
