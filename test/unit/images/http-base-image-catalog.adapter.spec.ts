import type { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { HttpBaseImageCatalogAdapter } from '../../../src/modules/images/infrastructure/catalog/http-base-image-catalog.adapter.js';
import { RsqlParser } from '../../../src/modules/shared/infrastructure/db/rsql-parser.js';

const URI = 'http://rmu-mfe-assets/images/manifest.json';
const TTL = 60_000;

const image = (path: string, extra: Record<string, unknown> = {}) => ({
  path,
  category: path.split('/')[1],
  contentType: 'image/png',
  sizeBytes: 10,
  width: 100,
  height: null,
  sha256: 'abc',
  ...extra,
});

const manifest = (...images: unknown[]) => ({ version: 1, generatedAt: '2026-10-31T00:00:00Z', images });

const json = (body: unknown, etag?: string) =>
  new Response(JSON.stringify(body), { status: 200, headers: etag ? { ETag: etag, 'Content-Type': 'application/json' } : {} });

const config = (values: Record<string, unknown>) =>
  ({
    get: (key: string) => values[key],
    getOrThrow: (key: string) => values[key],
  }) as unknown as ConfigService;

describe('HttpBaseImageCatalogAdapter', () => {
  let now: number;
  let fetchMock: ReturnType<typeof vi.fn>;
  let warn: ReturnType<typeof vi.spyOn>;
  let catalog: HttpBaseImageCatalogAdapter;

  beforeEach(() => {
    now = 1_000_000;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    catalog = new HttpBaseImageCatalogAdapter(
      config({ RMU_MEDIA_BASE_MANIFEST_URI: URI, RMU_MEDIA_BASE_MANIFEST_TTL_MS: TTL }),
      new RsqlParser(),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const paths = async (rsql?: string) => (await catalog.search(rsql)).map(entry => entry.path);
  const headersOf = (call: number) => (fetchMock.mock.calls[call] as [string, { headers: Record<string, string> }])[1].headers;

  it('loads the manifest once per TTL and sorts the images by path', async () => {
    fetchMock.mockResolvedValueOnce(json(manifest(image('images/races/b.png'), image('images/generic/a.png')), '"v1"'));
    expect(await paths()).toEqual(['images/generic/a.png', 'images/races/b.png']);
    now += TTL - 1;
    expect(await paths()).toEqual(['images/generic/a.png', 'images/races/b.png']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(URI);
    expect(headersOf(0)['If-None-Match']).toBeUndefined();
  });

  it('asks again after the TTL with the ETag, and a 304 keeps the cached copy', async () => {
    fetchMock.mockResolvedValueOnce(json(manifest(image('images/races/b.png')), '"v1"'));
    await paths();
    now += TTL;
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 304 }));
    expect(await paths()).toEqual(['images/races/b.png']);
    expect(headersOf(1)['If-None-Match']).toBe('"v1"');
    now += TTL - 1;
    await paths();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('replaces the copy when the manifest changed', async () => {
    fetchMock.mockResolvedValueOnce(json(manifest(image('images/races/b.png')), '"v1"'));
    await paths();
    now += TTL;
    fetchMock.mockResolvedValueOnce(json(manifest(image('images/races/c.png'))));
    expect(await paths()).toEqual(['images/races/c.png']);
    expect(await catalog.findByPath('images/races/b.png')).toBeNull();
    expect((await catalog.findByPath('images/races/c.png'))?.id).toBe('base:images/races/c.png');
    // Without an ETag the next request asks without If-None-Match.
    now += TTL;
    fetchMock.mockResolvedValueOnce(json(manifest(image('images/races/c.png'))));
    await paths();
    expect(headersOf(2)['If-None-Match']).toBeUndefined();
  });

  it('keeps the last good copy when the manifest fails, and tries again soon', async () => {
    fetchMock.mockResolvedValueOnce(json(manifest(image('images/races/b.png')), '"v1"'));
    await paths();
    now += TTL;
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }));
    expect(await paths()).toEqual(['images/races/b.png']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('keeping the last copy (1 images)'));
    now += 5_000;
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    expect(await paths()).toEqual(['images/races/b.png']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('has no images while the manifest never loaded', async () => {
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    expect(await paths()).toEqual([]);
    expect(await catalog.findByPath('images/races/b.png')).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no base images until it loads'));
    // A 304 without a copy (a confused server) is not a copy either.
    now += 5_000;
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 304 }));
    expect(await paths()).toEqual([]);
  });

  it.each([
    ['not a manifest', null],
    ['no image list', { version: 1 }],
    ['another version', { version: 2, images: [] }],
  ])('rejects a body that is %s', async (_name, body) => {
    fetchMock.mockResolvedValueOnce(json(body));
    expect(await paths()).toEqual([]);
    expect(warn).toHaveBeenCalled();
  });

  it('skips invalid entries and accepts missing dimensions', async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        manifest(
          image('images/races/ok.png', { width: undefined, sha256: undefined }),
          null,
          { path: '' },
          image('images/races/no-size.png', { sizeBytes: '10' }),
          image('images/races/no-type.png', { contentType: 1 }),
        ),
      ),
    );
    const [only, ...rest] = await catalog.search(undefined);
    expect(rest).toEqual([]);
    expect(only).toMatchObject({ path: 'images/races/ok.png', width: null, height: null, sha256: '' });
    expect(warn).toHaveBeenCalledWith('Skipped 4 invalid entries of the base image manifest');
  });

  it('filters with RSQL over the fields of ImageDto', async () => {
    fetchMock.mockResolvedValueOnce(
      json(manifest(image('images/races/b.png', { sizeBytes: 5000 }), image('images/generic/a.png'), image('images/races/c.webp'))),
    );
    expect(await paths('category==races')).toEqual(['images/races/b.png', 'images/races/c.webp']);
    expect(await paths('category==races;sizeBytes>1000')).toEqual(['images/races/b.png']);
    expect(await paths('source==user')).toEqual([]);
    expect(await paths('source==base;owner==null;verified!=null;visibility==public')).toHaveLength(3);
    expect(await paths('id=="base:images/generic/a.png"')).toEqual(['images/generic/a.png']);
  });

  it('rejects an invalid search before reading the manifest', async () => {
    await expect(catalog.search('category=>')).rejects.toMatchObject({ code: 'invalid-search' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shares one request among concurrent searches', async () => {
    let resolve!: (response: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>(done => (resolve = done)));
    const both = Promise.all([paths(), paths()]);
    resolve(json(manifest(image('images/races/b.png'))));
    expect(await both).toEqual([['images/races/b.png'], ['images/races/b.png']]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('defaults the TTL to a minute', async () => {
    catalog = new HttpBaseImageCatalogAdapter(config({ RMU_MEDIA_BASE_MANIFEST_URI: URI }), new RsqlParser());
    fetchMock.mockResolvedValue(json(manifest()));
    await paths();
    now += 59_999;
    await paths();
    now += 1;
    await paths();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
