import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { ImageRepository } from '../../application/ports/image-repository.port.js';
import { Image } from '../../domain/aggregates/image.js';
import { MongoBaseRepository } from '../../../shared/infrastructure/db/mongo.base.repository.js';
import { RsqlParser } from '../../../shared/infrastructure/db/rsql-parser.js';
import { type ImageDocument, ImageModel } from '../persistence/models/image.model.js';

@Injectable()
export class MongoImageRepository extends MongoBaseRepository<Image, ImageModel> implements ImageRepository {
  constructor(@InjectModel(ImageModel.name) imageModel: Model<ImageModel>, rsqlParser: RsqlParser) {
    super(imageModel, rsqlParser);
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
