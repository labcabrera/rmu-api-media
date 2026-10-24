import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Page } from '../../../../shared/application/pagination/page';
import { Image } from '../../../domain/aggregates/image';
import { ListImagesQuery } from '../queries/list-images.query';
import { type ImageRepository, IMAGE_REPOSITORY } from '../../ports/image-repository.port';

@QueryHandler(ListImagesQuery)
export class ListImagesHandler implements IQueryHandler<ListImagesQuery, Page<Image>> {
  constructor(@Inject(IMAGE_REPOSITORY) private readonly imageRepository: ImageRepository) {}

  async execute(query: ListImagesQuery): Promise<Page<Image>> {
    return await this.imageRepository.findByRsql(query.rsql || '', query.page, query.size);
  }
}
