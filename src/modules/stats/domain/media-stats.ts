import type { CollectionStats } from './collection-stats.js';

export interface ImageStats extends CollectionStats {
  /** Bytes of every stored image. */
  sizeBytes: number;
}

export interface MediaStats {
  images: ImageStats;
}
