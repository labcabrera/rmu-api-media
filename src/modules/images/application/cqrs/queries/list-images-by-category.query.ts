import type { ImageCategory } from '../../../domain/entities/image-category';

export class ListImagesByCategoryQuery {
  constructor(
    public readonly category: ImageCategory,
    public readonly page: number,
    public readonly size: number,
  ) {}
}
