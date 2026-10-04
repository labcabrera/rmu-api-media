import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose/dist/common/mongoose.decorators';
import { Model } from 'mongoose';
import { ImageRepository } from 'src/modules/images/application/ports/image-repository';
import { Image } from 'src/modules/images/domain/aggregates/image';
import type { ImageCategory } from 'src/modules/images/domain/entities/image-category';
import { Page } from 'src/modules/shared/domain/entities/page';
import { MongoBaseRepository } from 'src/modules/shared/infrastructure/db/mongo.base.repository';
import { RsqlParser } from 'src/modules/shared/infrastructure/persistence/repositories/rsql-parser';
import { ImageDocument, ImageModel } from '../persistence/models/image-model';

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
      id: doc.id as string,
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
