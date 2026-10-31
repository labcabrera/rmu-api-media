import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

export type ManifestImage = {
  path: string;
  category: string;
  contentType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  sha256: string;
};

const entry = (path: string, sizeBytes: number, width: number | null = 512, height: number | null = 512): ManifestImage => ({
  path,
  category: path.split('/')[1],
  contentType: path.endsWith('.webp') ? 'image/webp' : 'image/png',
  sizeBytes,
  width,
  height,
  sha256: createHash('sha256').update(path).digest('hex'),
});

/** The manifest the suite starts with: categories the other tests of images do not upload to. */
export const DEFAULT_BASE_IMAGES: ManifestImage[] = [
  entry('images/generic/warrior.png', 3_000),
  entry('images/backgrounds/scene-02.png', 2_000, 1920, 1080),
  entry('images/backgrounds/scene-01.png', 1_000, null, null),
];

/**
 * The rmu-mfe-assets manifest (spec 057, decision 1) on a free local port, as nginx serves it: with an ETag, and a 304
 * to a request whose If-None-Match matches. `fail` makes it answer 500, to test that the API keeps its last copy.
 */
export class LocalManifest {
  private server?: Server;
  images: ManifestImage[] = [...DEFAULT_BASE_IMAGES];
  fail = false;
  /** Status of each request served, in order. */
  readonly served: number[] = [];

  uri = '';

  private body() {
    return JSON.stringify({ version: 1, generatedAt: '2026-10-31T00:00:00.000Z', images: this.images });
  }

  async start(): Promise<void> {
    this.server = createServer((req, res) => {
      const body = this.body();
      const etag = `"${createHash('sha1').update(body).digest('hex')}"`;
      const status = this.fail ? 500 : req.headers['if-none-match'] === etag ? 304 : 200;
      this.served.push(status);
      res.statusCode = status;
      if (status === 200) {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('ETag', etag);
        res.end(body);
      } else {
        res.end();
      }
    });
    await new Promise<void>(resolve => this.server!.listen(0, '127.0.0.1', resolve));
    this.uri = `http://127.0.0.1:${(this.server.address() as AddressInfo).port}/images/manifest.json`;
  }

  async stop(): Promise<void> {
    await new Promise<void>(resolve => (this.server ? this.server.close(() => resolve()) : resolve()));
  }
}
