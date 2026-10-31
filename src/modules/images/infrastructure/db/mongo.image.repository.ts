import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ImageRepository, ImageSlice } from '../../application/ports/image-repository.port.js';
import { Image } from '../../domain/aggregates/image.js';
import { DEFAULT_IMAGE_VISIBILITY } from '../../domain/entities/image-visibility.js';
import { MongoBaseRepository } from '../../../shared/infrastructure/db/mongo.base.repository.js';
import { bindSelectors } from '../../../shared/infrastructure/db/rsql-matcher.js';
import { RsqlParser } from '../../../shared/infrastructure/db/rsql-parser.js';
import { type ImageDocument, ImageModel } from '../persistence/models/image.model.js';

@Injectable()
export class MongoImageRepository extends MongoBaseRepository<Image, ImageModel> implements ImageRepository {
  constructor(@InjectModel(ImageModel.name) imageModel: Model<ImageModel>, rsqlParser: RsqlParser) {
    super(imageModel, rsqlParser);
  }

  async findSlice(rsql: string | undefined, skip: number, limit: number): Promise<ImageSlice> {
    const node = this.rsqlParser.parseExpression(rsql);
    // Every stored image is a user image: `source` is decided here and never reaches Mongo.
    const bound = node ? bindSelectors(node, { source: 'user' }) : true;
    if (bound === false) return { content: [], totalElements: 0 };
    const filter = bound === true ? {} : this.rsqlParser.toMongo(bound);
    const [docs, totalElements] = await Promise.all([
      limit > 0 ? this.model.find(filter).sort({ _id: 1 }).skip(skip).limit(limit) : Promise.resolve([]),
      this.model.countDocuments(filter),
    ]);
    return { content: docs.map(doc => this.toEntity(doc)), totalElements };
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
      visibility: doc.visibility ?? DEFAULT_IMAGE_VISIBILITY,
      owner: doc.owner,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
  }
}
