import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Page } from 'src/modules/shared/domain/entities/page';
import { Image } from '../../../domain/aggregates/image';
import { ListImagesQuery } from '../queries/list-images.query';
import type { ImageRepository } from '../../ports/image-repository';

@QueryHandler(ListImagesQuery)
export class ListImagesHandler implements IQueryHandler<ListImagesQuery, Page<Image>> {
  constructor(@Inject('ImageRepository') private readonly imageRepository: ImageRepository) {}

  async execute(query: ListImagesQuery): Promise<Page<Image>> {
    return await this.imageRepository.findByRsql(query.rsql || '', query.page, query.size);
  }
}
