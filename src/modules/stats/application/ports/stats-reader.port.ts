import type { MediaStats } from '../../domain/media-stats.js';

export const STATS_READER = Symbol('StatsReader');

/** Counts of the collections of the API, for the administration dashboard (spec 053). */
export interface StatsReader {
  read(now: Date): Promise<MediaStats>;
}
