import sharp from 'sharp';
import request from 'supertest';
import { BASE_FOLDER, ids, startApp, type E2eApp } from './support/app.js';

type ImageBody = {
  id: string;
  category: string;
  url: string;
  storageKey: string;
  contentType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  originalFilename?: string;
  altText?: string;
  metadata?: Record<string, string>;
  verified: boolean;
  owner: string;
};

const picture = (format: 'png' | 'jpeg', width = 200, height = 100) =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 40, b: 40 } } })
    [format]()
    .toBuffer();

let e2e: E2eApp;

beforeAll(async () => {
  e2e = await startApp();
});

afterAll(async () => {
  await e2e?.stop();
});

const upload = async (user: 'owner' | 'other' | 'admin' | 'noRole', category = 'avatars', format: 'png' | 'jpeg' = 'png') =>
  request(e2e.server)
    .post('/v1/images')
    .set('Authorization', e2e.auth(user))
    .field('category', category)
    .field('altText', 'E2E image')
    .attach('file', await picture(format), { filename: `e2e.${format === 'png' ? 'png' : 'jpg'}`, contentType: `image/${format}` });

describe('authentication', () => {
  it('rejects a request without a token', async () => {
    const response = await request(e2e.server).get('/v1/images');
    expect(response.status).toBe(401);
  });

  it('rejects a token signed with another key', async () => {
    const response = await request(e2e.server).get('/v1/images').set('Authorization', 'Bearer a.b.c');
    expect(response.status).toBe(401);
  });

  // Images have no accessType: any authenticated user reads them (spec 021, decision 2).
  it('lets a user without roles list the images', async () => {
    const response = await request(e2e.server).get('/v1/images').set('Authorization', e2e.auth('noRole'));
    expect(response.status).toBe(200);
  });

  it('rejects an upload from a user without roles [F-media-06]', async () => {
    const response = await upload('noRole');
    expect(response.status).toBe(403);
  });
});

describe('upload', () => {
  it('scales a PNG to the maximum width, stores it under its category and keeps it as PNG', async () => {
    const response = await upload('owner');
    expect(response.status).toBe(201);
    const image = response.body as ImageBody;
    expect(image).toMatchObject({
      category: 'avatars',
      contentType: 'image/png',
      width: 64,
      height: 32,
      altText: 'E2E image',
      originalFilename: 'e2e.png',
      verified: false,
      owner: 'e2e-owner',
    });
    expect(image.storageKey).toBe(`images/avatars/${image.id}.png`);
    expect(image.url).toBe(image.storageKey);
    const stored = e2e.bucket.get(`${BASE_FOLDER}/${image.storageKey}`);
    expect(stored?.contentType).toBe('image/png');
    expect(stored?.body.length).toBe(image.sizeBytes);
  });

  it('re-encodes anything that is not a PNG as JPEG', async () => {
    const response = await upload('owner', 'items', 'jpeg');
    expect(response.status).toBe(201);
    const image = response.body as ImageBody;
    expect(image.contentType).toBe('image/jpeg');
    expect(image.storageKey).toBe(`images/items/${image.id}.jpg`);
  });

  it('requires a file', async () => {
    const response = await request(e2e.server).post('/v1/images').set('Authorization', e2e.auth('owner')).field('category', 'avatars');
    expect(response.status).toBe(400);
  });

  it('rejects a file that is not an image', async () => {
    const response = await request(e2e.server)
      .post('/v1/images')
      .set('Authorization', e2e.auth('owner'))
      .field('category', 'avatars')
      .attach('file', Buffer.from('plain text'), { filename: 'e2e.txt', contentType: 'text/plain' });
    expect(response.status).toBe(400);
  });

  it('rejects an unknown category', async () => {
    const response = await upload('owner', 'not-a-category');
    expect(response.status).toBe(400);
  });
});

describe('list', () => {
  it('filters with RSQL and pages the result', async () => {
    await upload('owner', 'races');
    await upload('owner', 'races');
    await upload('other', 'races');
    const first = await request(e2e.server)
      .get('/v1/images')
      .query({ q: 'category==races', page: 0, size: 2 })
      .set('Authorization', e2e.auth('owner'));
    expect(first.status).toBe(200);
    const body = first.body as { content: ImageBody[]; pagination: { page: number; size: number; totalElements: number } };
    expect(body.content).toHaveLength(2);
    expect(body.content.every(image => image.category === 'races')).toBe(true);
    expect(body.pagination).toMatchObject({ page: 0, size: 2, totalElements: 3 });
    const second = await request(e2e.server)
      .get('/v1/images')
      .query({ q: 'category==races', page: 1, size: 2 })
      .set('Authorization', e2e.auth('owner'));
    expect(ids(second.body)).toHaveLength(1);
  });

  it('answers 400 to an invalid search', async () => {
    const response = await request(e2e.server).get('/v1/images').query({ q: 'category=>' }).set('Authorization', e2e.auth('owner'));
    expect(response.status).toBe(400);
  });

  it('answers 400 to a negative page', async () => {
    const response = await request(e2e.server).get('/v1/images').query({ page: -1 }).set('Authorization', e2e.auth('owner'));
    expect(response.status).toBe(400);
  });

  it('accepts pages of up to 100 images', async () => {
    const accepted = await request(e2e.server).get('/v1/images').query({ size: 100 }).set('Authorization', e2e.auth('owner'));
    expect(accepted.status).toBe(200);
    const rejected = await request(e2e.server).get('/v1/images').query({ size: 101 }).set('Authorization', e2e.auth('owner'));
    expect(rejected.status).toBe(400);
    // The path of the error body leaves the query out [F-receta-22].
    expect(rejected.body).toMatchObject({ code: 'bad-request', path: '/v1/images' });
  });
});

describe('update', () => {
  it('changes the metadata of an image of its owner', async () => {
    const created = (await upload('owner')).body as ImageBody;
    const response = await request(e2e.server)
      .patch(`/v1/images/${created.id}`)
      .set('Authorization', e2e.auth('owner'))
      .field('altText', 'Changed')
      .field('category', 'icons');
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ id: created.id, altText: 'Changed', category: 'icons', storageKey: created.storageKey });
  });

  it('replaces the content and removes the previous object when its key changes', async () => {
    const created = (await upload('owner')).body as ImageBody;
    const response = await request(e2e.server)
      .patch(`/v1/images/${created.id}`)
      .set('Authorization', e2e.auth('owner'))
      .attach('file', await picture('jpeg', 300, 300), { filename: 'new.jpg', contentType: 'image/jpeg' });
    expect(response.status).toBe(200);
    const updated = response.body as ImageBody;
    expect(updated).toMatchObject({ contentType: 'image/jpeg', width: 64, height: 64, originalFilename: 'new.jpg' });
    expect(updated.storageKey).toBe(`images/avatars/${created.id}.jpg`);
    expect(e2e.bucket.has(`${BASE_FOLDER}/${created.storageKey}`)).toBe(false);
    expect(e2e.bucket.has(`${BASE_FOLDER}/${updated.storageKey}`)).toBe(true);
  });

  // F-media-07 (descartado): the storage key is fixed when the image is uploaded; a new category only changes the metadata.
  it('keeps the object under the old category when the category changes', async () => {
    const created = (await upload('owner')).body as ImageBody;
    const response = await request(e2e.server)
      .patch(`/v1/images/${created.id}`)
      .set('Authorization', e2e.auth('owner'))
      .field('category', 'npcs');
    expect((response.body as ImageBody).storageKey).toBe(created.storageKey);
  });

  it('answers 404 to an unknown image, in the common error format', async () => {
    const response = await request(e2e.server).patch('/v1/images/unknown').set('Authorization', e2e.auth('owner')).field('altText', 'x');
    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ statusCode: 404, error: 'NotFoundError', code: 'not-found', path: '/v1/images/unknown' });
    expect(typeof (response.body as { timestamp: string }).timestamp).toBe('string');
  });

  it('counts the writes in the version and rejects a change made on a stale version', async () => {
    const created = (await upload('owner')).body as ImageBody & { version: number };
    expect(created.version).toBe(0);
    const first = await request(e2e.server)
      .patch(`/v1/images/${created.id}`)
      .set('Authorization', e2e.auth('owner'))
      .field('altText', 'First')
      .field('version', '0');
    expect(first.status).toBe(200);
    expect((first.body as { version: number }).version).toBe(1);
    const stale = await request(e2e.server)
      .patch(`/v1/images/${created.id}`)
      .set('Authorization', e2e.auth('owner'))
      .field('altText', 'Stale')
      .field('version', '0');
    expect(stale.status).toBe(409);
    expect((stale.body as { code: string }).code).toBe('version-conflict');
    const withoutVersion = await request(e2e.server)
      .patch(`/v1/images/${created.id}`)
      .set('Authorization', e2e.auth('owner'))
      .field('altText', 'Latest');
    expect(withoutVersion.body as { version: number; altText: string }).toMatchObject({ version: 2, altText: 'Latest' });
  });

  it('does not write a change that leaves the image as it was [F-receta-23]', async () => {
    const created = (await upload('owner')).body as ImageBody & { version: number };
    const images = e2e.connection.collection('images');
    const before = await images.findOne({ _id: created.id as never });
    const response = await request(e2e.server)
      .patch(`/v1/images/${created.id}`)
      .set('Authorization', e2e.auth('owner'))
      .field('altText', created.altText!)
      .field('category', created.category);
    expect(response.status).toBe(200);
    expect((response.body as { version: number }).version).toBe(0);
    const after = await images.findOne({ _id: created.id as never });
    expect(after).toEqual(before);
  });

  it('rejects a change from another user [F-media-06]', async () => {
    const created = (await upload('owner')).body as ImageBody;
    const response = await request(e2e.server)
      .patch(`/v1/images/${created.id}`)
      .set('Authorization', e2e.auth('other'))
      .field('altText', 'Not mine');
    expect(response.status).toBe(403);
  });
});

describe('delete', () => {
  it('removes the image and its stored object', async () => {
    const created = (await upload('owner')).body as ImageBody;
    const response = await request(e2e.server).delete(`/v1/images/${created.id}`).set('Authorization', e2e.auth('owner'));
    expect(response.status).toBe(204);
    expect(e2e.bucket.has(`${BASE_FOLDER}/${created.storageKey}`)).toBe(false);
    const again = await request(e2e.server).delete(`/v1/images/${created.id}`).set('Authorization', e2e.auth('owner'));
    expect(again.status).toBe(404);
  });

  it('rejects a deletion from another user [F-media-06]', async () => {
    const created = (await upload('owner')).body as ImageBody;
    const response = await request(e2e.server).delete(`/v1/images/${created.id}`).set('Authorization', e2e.auth('other'));
    expect(response.status).toBe(403);
  });
});

describe('permissions [F-media-06]', () => {
  type Caller = 'owner' | 'other' | 'admin' | 'noRole' | 'none';
  const as = (test: request.Test, caller: Caller) => (caller === 'none' ? test : test.set('Authorization', e2e.auth(caller)));
  const ownImage = async () => ((await upload('owner')).body as ImageBody).id;

  it.each<[Caller, number]>([
    ['owner', 201],
    ['admin', 201],
    ['noRole', 403],
    ['none', 401],
  ])('upload as %s answers %i', async (caller, status) => {
    const test = as(request(e2e.server).post('/v1/images'), caller)
      .field('category', 'avatars')
      .attach('file', await picture('png'), { filename: 'e2e.png', contentType: 'image/png' });
    expect((await test).status).toBe(status);
  });

  it.each<[Caller, number]>([
    ['owner', 200],
    ['other', 403],
    ['admin', 200],
    ['noRole', 403],
    ['none', 401],
  ])('update of the image of owner as %s answers %i', async (caller, status) => {
    const id = await ownImage();
    const response = await as(request(e2e.server).patch(`/v1/images/${id}`), caller).field('altText', `By ${caller}`);
    expect(response.status).toBe(status);
    if (status === 403) expect((response.body as { code: string }).code).toBe('forbidden');
  });

  it.each<[Caller, number]>([
    ['owner', 204],
    ['other', 403],
    ['admin', 204],
    ['noRole', 403],
    ['none', 401],
  ])('delete of the image of owner as %s answers %i', async (caller, status) => {
    const id = await ownImage();
    const response = await as(request(e2e.server).delete(`/v1/images/${id}`), caller);
    expect(response.status).toBe(status);
    if (status === 403) {
      const still = await request(e2e.server)
        .get('/v1/images')
        .query({ q: `id==${id}` })
        .set('Authorization', e2e.auth('admin'));
      expect(ids(still.body)).toEqual([id]);
    }
  });
});
