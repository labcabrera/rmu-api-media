import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ImageRepository } from '../../application/ports/image-repository.port';
import { Image } from '../../domain/aggregates/image';
import type { ImageCategory } from '../../domain/entities/image-category';
import { Page } from '../../../shared/application/pagination/page';
import { MongoBaseRepository } from '../../../shared/infrastructure/db/mongo.base.repository';
import { RsqlParser } from '../../../shared/infrastructure/db/rsql-parser';
import { ImageDocument, ImageModel } from '../persistence/models/image.model';

@Injectable()
export class MongoImageRepository extends MongoBaseRepository<Image, ImageDocument> implements ImageRepository {
  constructor(@InjectModel(ImageModel.name) imageModel: Model<ImageDocument>, rsqlParser: RsqlParser) {
    super(imageModel, rsqlParser);
  }

  async findByCategory(category: ImageCategory, page: number, size: number): Promise<Page<Image>> {
    const skip = page * size;
    const [docs, totalElements] = await Promise.all([
      this.model.find({ category }).skip(skip).limit(size).sort({ createdAt: -1 }),
      this.model.countDocuments({ category }),
    ]);
    return new Page<Image>(
      docs.map(doc => this.mapToEntity(doc)),
      page,
      size,
      totalElements,
    );
  }

  async findByStorageKey(storageKey: string): Promise<Image | null> {
    const doc = await this.model.findOne({ storageKey });
    return doc ? this.mapToEntity(doc) : null;
  }

  protected mapToEntity(doc: ImageDocument): Image {
    return Image.fromProps({
      id: doc.id,
      category: doc.category,
      storageKey: doc.storageKey,
      url: doc.url,
      contentType: doc.contentType,
      sizeBytes: doc.sizeBytes,
      width: doc.width,
      height: doc.height,
      originalFilename: doc.originalFilename,
      altText: doc.altText,
      metadata: doc.metadata,
      verified: doc.verified ?? false,
      owner: doc.owner,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }
}
