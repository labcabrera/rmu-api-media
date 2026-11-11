import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import { ImageModel } from '../../../images/infrastructure/persistence/models/image.model.js';
import type { StatsReader } from '../../application/ports/stats-reader.port.js';
import type { MediaStats } from '../../domain/media-stats.js';
import { readCollectionStats } from './collection-stats.reader.js';

@Injectable()
export class MongoStatsReader implements StatsReader {
  constructor(@InjectModel(ImageModel.name) private readonly images: Model<ImageModel>) {}

  async read(now: Date): Promise<MediaStats> {
    const [images, [size]] = await Promise.all([
      readCollectionStats(this.images, now),
      this.images.aggregate<{ sizeBytes: number }>([{ $group: { _id: null, sizeBytes: { $sum: '$sizeBytes' } } }]),
    ]);
    return { images: { ...images, sizeBytes: size?.sizeBytes ?? 0 } };
  }
}
