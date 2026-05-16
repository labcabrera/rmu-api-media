import { Inject } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Page } from 'src/modules/shared/domain/entities/page';
import { Image } from '../../../domain/aggregates/image';
import { ListImagesByCategoryQuery } from '../queries/list-images-by-category.query';
import type { ImageRepository } from '../../ports/image-repository';

@QueryHandler(ListImagesByCategoryQuery)
export class ListImagesByCategoryHandler implements IQueryHandler<ListImagesByCategoryQuery, Page<Image>> {
  constructor(@Inject('ImageRepository') private readonly imageRepository: ImageRepository) {}

  async execute(query: ListImagesByCategoryQuery): Promise<Page<Image>> {
    return await this.imageRepository.findByCategory(query.category, query.page, query.size);
  }
}
