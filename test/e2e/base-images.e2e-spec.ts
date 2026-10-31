import sharp from 'sharp';
import request from 'supertest';
import { startApp, type E2eApp } from './support/app.js';
import { DEFAULT_BASE_IMAGES } from './support/manifest.js';

// Base images (spec 057, decision 2): read from the rmu-mfe-assets manifest, listed with the user images, read-only.
type ImageBody = { id: string; source: string; url: string; category: string; owner: string | null; verified: boolean; version: number };
type PageBody = { content: ImageBody[]; pagination: { page: number; size: number; totalElements: number; totalPages: number } };

const BASE_PATHS = DEFAULT_BASE_IMAGES.map(image => image.path).sort();
const encoded = (path: string) => encodeURIComponent(`base:${path}`);

let e2e: E2eApp;

beforeAll(async () => {
  e2e = await startApp();
});

afterAll(async () => {
  await e2e?.stop();
});

beforeEach(() => {
  e2e.manifest.images = [...DEFAULT_BASE_IMAGES];
  e2e.manifest.fail = false;
});

const list = async (query: Record<string, string | number>) => {
  const response = await request(e2e.server).get('/v1/images').query(query).set('Authorization', e2e.auth('owner'));
  expect(response.status).toBe(200);
  return response.body as PageBody;
};

const upload = async (category: string) => {
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } } })
    .png()
    .toBuffer();
  const response = await request(e2e.server)
    .post('/v1/images')
    .set('Authorization', e2e.auth('owner'))
    .field('category', category)
    .attach('file', png, { filename: 'e2e.png', contentType: 'image/png' });
  expect(response.status).toBe(201);
  return response.body as ImageBody;
};

describe('listing', () => {
  let userIds: string[];

  beforeAll(async () => {
    const uploaded = [await upload('avatars'), await upload('avatars')];
    userIds = uploaded.map(image => image.id).sort();
  });

  it('gives the base images first, sorted by path, then the user images sorted by id', async () => {
    const page = await list({ size: 100 });
    expect(page.content.map(image => image.id)).toEqual([...BASE_PATHS.map(path => `base:${path}`), ...userIds]);
    expect(page.pagination.totalElements).toBe(BASE_PATHS.length + userIds.length);
    expect(page.content[0]).toMatchObject({
      source: 'base',
      visibility: 'public',
      url: BASE_PATHS[0],
      owner: null,
      verified: true,
      version: 0,
      category: 'backgrounds',
    });
    expect(page.content.at(-1)).toMatchObject({ source: 'user', owner: 'e2e-owner' });
  });

  it('pages across both sources, with a page that holds the last base image and the first user one', async () => {
    const total = BASE_PATHS.length + userIds.length;
    const first = await list({ page: 0, size: 2 });
    const second = await list({ page: 1, size: 2 });
    const third = await list({ page: 2, size: 2 });
    expect(first.content.map(image => image.id)).toEqual(BASE_PATHS.slice(0, 2).map(path => `base:${path}`));
    expect(second.content.map(image => image.id)).toEqual([`base:${BASE_PATHS[2]}`, userIds[0]]);
    expect(third.content.map(image => image.id)).toEqual([userIds[1]]);
    expect(second.pagination).toEqual({ page: 1, size: 2, totalElements: total, totalPages: Math.ceil(total / 2) });
    expect((await list({ page: 3, size: 2 })).content).toEqual([]);
  });

  it.each([
    ['source==base', BASE_PATHS.length, 0],
    ['source==user;category==avatars', 0, 2],
    ['source=in=(base,user);category==avatars', 0, 2],
    ['source!=user', BASE_PATHS.length, 0],
    ['category==backgrounds', 2, 0],
    ['category==backgrounds,category==avatars', 2, 2],
    ['category==backgrounds;width>1000', 1, 0],
    ['url=re=WARRIOR', 1, 0],
    ['owner==null', BASE_PATHS.length, 0],
    ['id=="base:images/generic/warrior.png"', 1, 0],
  ])('filters %s on both sources', async (q, base, user) => {
    const page = await list({ q, size: 100 });
    expect(page.content.filter(image => image.source === 'base')).toHaveLength(base);
    expect(page.content.filter(image => image.source === 'user')).toHaveLength(user);
    expect(page.pagination.totalElements).toBe(base + user);
  });

  it('answers 400 to an invalid search', async () => {
    const response = await request(e2e.server).get('/v1/images').query({ q: 'source==' }).set('Authorization', e2e.auth('owner'));
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'invalid-search' });
  });
});

describe('manifest', () => {
  it('sees a new image of the manifest without touching Mongo, and revalidates with the ETag', async () => {
    await list({ q: 'source==base' });
    e2e.manifest.served.length = 0;
    await list({ q: 'source==base' });
    expect(e2e.manifest.served).toEqual([304]);

    e2e.manifest.images = [...DEFAULT_BASE_IMAGES, { ...DEFAULT_BASE_IMAGES[0], path: 'images/generic/new.png' }];
    const page = await list({ q: 'source==base', size: 100 });
    expect(page.content.map(image => image.url)).toContain('images/generic/new.png');
    expect(e2e.manifest.served.at(-1)).toBe(200);
  });

  it('keeps the last copy when the manifest fails', async () => {
    await list({ q: 'source==base' });
    e2e.manifest.fail = true;
    const page = await list({ q: 'source==base', size: 100 });
    expect(page.content.map(image => image.url)).toEqual(BASE_PATHS);
  });
});

describe('a base image', () => {
  const path = 'images/generic/warrior.png';

  it('is read by its encoded id', async () => {
    const response = await request(e2e.server)
      .get(`/v1/images/${encoded(path)}`)
      .set('Authorization', e2e.auth('noRole'));
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: `base:${path}`, url: path, source: 'base', contentType: 'image/png', sizeBytes: 3000 });
  });

  it('answers 404 to a path that is not in the manifest', async () => {
    const response = await request(e2e.server)
      .get(`/v1/images/${encoded('images/generic/none.png')}`)
      .set('Authorization', e2e.auth('owner'));
    expect(response.status).toBe(404);
  });

  it('cannot be changed or deleted, not even by an administrator', async () => {
    const auth = e2e.auth('admin');
    const patch = await request(e2e.server)
      .patch(`/v1/images/${encoded(path)}`)
      .set('Authorization', auth)
      .field('altText', 'x');
    expect(patch.status).toBe(403);
    expect(patch.body).toMatchObject({ statusCode: 403, code: 'base-image-read-only', error: 'BaseImageReadOnlyError' });
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } } })
      .png()
      .toBuffer();
    const file = await request(e2e.server)
      .patch(`/v1/images/${encoded(path)}`)
      .set('Authorization', auth)
      .attach('file', png, { filename: 'x.png', contentType: 'image/png' });
    expect(file.body).toMatchObject({ code: 'base-image-read-only' });
    const removed = await request(e2e.server)
      .delete(`/v1/images/${encoded(path)}`)
      .set('Authorization', auth);
    expect(removed.status).toBe(403);
    expect(removed.body).toMatchObject({ code: 'base-image-read-only' });
  });
});

describe('a user image', () => {
  it('is read by its id', async () => {
    const created = await upload('npcs');
    const response = await request(e2e.server).get(`/v1/images/${created.id}`).set('Authorization', e2e.auth('other'));
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: created.id, source: 'user', url: `uploads/npcs/${created.id}.png` });
  });

  it('answers 404 to an unknown id', async () => {
    const response = await request(e2e.server).get('/v1/images/unknown').set('Authorization', e2e.auth('owner'));
    expect(response.status).toBe(404);
  });

  it('of the layout before spec 057 is deleted without removing an object outside the uploads prefix', async () => {
    const id = 'legacy-image';
    await e2e.connection.collection('images').insertOne({
      _id: id as never,
      category: 'avatars',
      storageKey: `images/avatars/${id}.png`,
      url: `images/avatars/${id}.png`,
      contentType: 'image/png',
      sizeBytes: 1,
      verified: false,
      owner: 'e2e-owner',
      createdAt: new Date(),
    });
    e2e.bucket.set(`images/avatars/${id}.png`, { body: Buffer.from('x') });
    const read = await request(e2e.server).get(`/v1/images/${id}`).set('Authorization', e2e.auth('owner'));
    expect(read.body).toMatchObject({ visibility: 'public', source: 'user' });
    const response = await request(e2e.server).delete(`/v1/images/${id}`).set('Authorization', e2e.auth('owner'));
    expect(response.status).toBe(204);
    expect(e2e.bucket.has(`images/avatars/${id}.png`)).toBe(true);
  });
});
