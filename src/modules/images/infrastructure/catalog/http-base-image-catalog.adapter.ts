import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BaseImageCatalogPort } from '../../application/ports/base-image-catalog.port.js';
import { BaseImage, type BaseImageProps } from '../../domain/entities/base-image.js';
import { matchesRsql } from '../../../shared/infrastructure/db/rsql-matcher.js';
import { RsqlParser } from '../../../shared/infrastructure/db/rsql-parser.js';

/** The manifest rmu-mfe-assets publishes at images/manifest.json (spec 057, decision 1). */
interface Manifest {
  version: number;
  generatedAt?: string;
  images: unknown[];
}

const MANIFEST_VERSION = 1;
const FETCH_TIMEOUT_MS = 5_000;
/** After a failed load, the next request tries again after this long at most (or the TTL, when shorter). */
const RETRY_AFTER_FAILURE_MS = 5_000;

/**
 * Reads the base images from the manifest of rmu-mfe-assets (RMU_MEDIA_BASE_MANIFEST_URI) and keeps them in memory.
 * A request after RMU_MEDIA_BASE_MANIFEST_TTL_MS asks again with the ETag of the copy it has (`If-None-Match`): a 304
 * keeps it. When the manifest cannot be read the last good copy stays (with a warning), and with none the catalog is
 * empty, so the listing still answers with the user images.
 */
@Injectable()
export class HttpBaseImageCatalogAdapter implements BaseImageCatalogPort {
  private readonly logger = new Logger(HttpBaseImageCatalogAdapter.name);
  private readonly uri: string;
  private readonly ttlMs: number;

  private images: BaseImage[] | undefined;
  private byPath = new Map<string, BaseImage>();
  private etag: string | undefined;
  /** When the cache was last confirmed (or a load last failed), in ms. */
  private checkedAt = 0;
  private lastLoadFailed = false;
  private loading: Promise<BaseImage[]> | undefined;

  constructor(
    configService: ConfigService,
    private readonly rsqlParser: RsqlParser,
  ) {
    this.uri = configService.getOrThrow<string>('RMU_MEDIA_BASE_MANIFEST_URI');
    this.ttlMs = Number(configService.get<number>('RMU_MEDIA_BASE_MANIFEST_TTL_MS') ?? 60_000);
  }

  async search(rsql: string | undefined): Promise<BaseImage[]> {
    // Parsed first, so an invalid expression is a 400 even before the manifest is read.
    const node = this.rsqlParser.parseExpression(rsql);
    const images = await this.load();
    return node ? images.filter(image => matchesRsql(node, image.toSearchRecord())) : images;
  }

  async findByPath(path: string): Promise<BaseImage | null> {
    await this.load();
    return this.byPath.get(path) ?? null;
  }

  /** The images of the manifest, read again when the cached copy is older than the TTL. */
  private load(): Promise<BaseImage[]> {
    const maxAge = this.lastLoadFailed ? Math.min(this.ttlMs, RETRY_AFTER_FAILURE_MS) : this.ttlMs;
    if (Date.now() - this.checkedAt < maxAge) return Promise.resolve(this.images ?? []);
    // Concurrent requests share one fetch.
    this.loading ??= this.refresh().finally(() => (this.loading = undefined));
    return this.loading;
  }

  private async refresh(): Promise<BaseImage[]> {
    try {
      const headers: Record<string, string> = { Accept: 'application/json' };
      if (this.etag && this.images) headers['If-None-Match'] = this.etag;
      const response = await fetch(this.uri, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (response.status === 304 && this.images) {
        this.markChecked(false);
        return this.images;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const images = this.parse(await response.json());
      this.images = images;
      this.byPath = new Map(images.map(image => [image.path, image]));
      this.etag = response.headers.get('etag') ?? undefined;
      this.markChecked(false);
      this.logger.log(`Loaded ${images.length} base images from ${this.uri}`);
      return images;
    } catch (error) {
      this.markChecked(true);
      const kept = this.images ? `keeping the last copy (${this.images.length} images)` : 'no base images until it loads';
      this.logger.warn(`Could not read the base image manifest ${this.uri}: ${(error as Error).message}; ${kept}`);
      return this.images ?? [];
    }
  }

  private markChecked(failed: boolean) {
    this.checkedAt = Date.now();
    this.lastLoadFailed = failed;
  }

  private parse(body: unknown): BaseImage[] {
    const manifest = body as Partial<Manifest> | null;
    if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.images)) throw new Error('Not an image manifest');
    if (manifest.version !== MANIFEST_VERSION) throw new Error(`Unsupported manifest version ${String(manifest.version)}`);
    const images: BaseImage[] = [];
    let invalid = 0;
    for (const entry of manifest.images) {
      const props = toProps(entry);
      if (props) images.push(new BaseImage(props));
      else invalid++;
    }
    if (invalid > 0) this.logger.warn(`Skipped ${invalid} invalid entries of the base image manifest`);
    return images.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }
}

function toProps(entry: unknown): BaseImageProps | undefined {
  if (!entry || typeof entry !== 'object') return undefined;
  const value = entry as Record<string, unknown>;
  const { path, category, contentType, sizeBytes, sha256 } = value;
  if (typeof path !== 'string' || path === '' || typeof category !== 'string' || typeof contentType !== 'string') return undefined;
  if (typeof sizeBytes !== 'number') return undefined;
  const dimension = (field: unknown) => (typeof field === 'number' ? field : null);
  return {
    path,
    category,
    contentType,
    sizeBytes,
    width: dimension(value.width),
    height: dimension(value.height),
    sha256: typeof sha256 === 'string' ? sha256 : '',
  };
}
