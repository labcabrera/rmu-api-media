import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Page } from '../../../../shared/application/pagination/page.js';
import type { ImageView } from '../../image-view.js';
import { BASE_IMAGE_CATALOG, type BaseImageCatalogPort } from '../../ports/base-image-catalog.port.js';
import { type ImageRepository, IMAGE_REPOSITORY } from '../../ports/image-repository.port.js';
import { ListImagesQuery } from '../queries/list-images.query.js';

/**
 * One listing over both sources (spec 057, decision 2): the base images first, sorted by path, then the user images
 * sorted by id. A page is a window of that sequence, so it may hold the last base images and the first user ones, and
 * totalElements counts the matches of both.
 */
@QueryHandler(ListImagesQuery)
export class ListImagesHandler implements IQueryHandler<ListImagesQuery, Page<ImageView>> {
  constructor(
    @Inject(IMAGE_REPOSITORY) private readonly imageRepository: ImageRepository,
    @Inject(BASE_IMAGE_CATALOG) private readonly baseImages: BaseImageCatalogPort,
  ) {}

  async execute(query: ListImagesQuery): Promise<Page<ImageView>> {
    const rsql = query.rsql || '';
    const base = await this.baseImages.search(rsql);
    const start = query.page * query.size;
    const baseContent = base.slice(start, start + query.size);
    const users = await this.imageRepository.findSlice(rsql, Math.max(0, start - base.length), query.size - baseContent.length);
    return new Page<ImageView>([...baseContent, ...users.content], query.page, query.size, base.length + users.totalElements);
  }
}
