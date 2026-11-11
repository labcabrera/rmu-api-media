import sharp from 'sharp';
import request from 'supertest';
import { ids, startApp, UPLOAD_MAX_BYTES, type E2eApp } from './support/app.js';

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
  owner: string | null;
  source: string;
  visibility: string;
  scope?: string;
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
      source: 'user',
      visibility: 'public',
    });
    expect(image.storageKey).toBe(`uploads/avatars/${image.id}.png`);
    expect(image.url).toBe(image.storageKey);
    const stored = e2e.bucket.get(image.storageKey);
    expect(stored?.contentType).toBe('image/png');
    expect(stored?.body.length).toBe(image.sizeBytes);
  });

  it('re-encodes anything that is not a PNG as JPEG', async () => {
    const response = await upload('owner', 'items', 'jpeg');
    expect(response.status).toBe(201);
    const image = response.body as ImageBody;
    expect(image.contentType).toBe('image/jpeg');
    expect(image.storageKey).toBe(`uploads/items/${image.id}.jpg`);
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

  it('answers 413 to a file larger than RMU_MEDIA_UPLOAD_MAX_BYTES, in the common error format', async () => {
    const response = await request(e2e.server)
      .post('/v1/images')
      .set('Authorization', e2e.auth('owner'))
      .field('category', 'avatars')
      .attach('file', Buffer.alloc(UPLOAD_MAX_BYTES + 1, 1), { filename: 'big.png', contentType: 'image/png' });
    expect(response.status).toBe(413);
    expect(response.body).toMatchObject({ statusCode: 413, code: 'payload-too-large', path: '/v1/images' });
  });

  it('answers 400 to a file that claims to be an image but is not one', async () => {
    const response = await request(e2e.server)
      .post('/v1/images')
      .set('Authorization', e2e.auth('owner'))
      .field('category', 'avatars')
      .attach('file', Buffer.from('not a png'), { filename: 'fake.png', contentType: 'image/png' });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'validation' });
    expect([...e2e.bucket.keys()].some(key => key.includes('fake'))).toBe(false);
  });

  it('accepts a WebP upload and stores it as JPEG', async () => {
    const webp = await sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 0, b: 0 } } })
      .webp()
      .toBuffer();
    const response = await request(e2e.server)
      .post('/v1/images')
      .set('Authorization', e2e.auth('owner'))
      .field('category', 'avatars')
      .attach('file', webp, { filename: 'e2e.webp', contentType: 'image/webp' });
    expect(response.status).toBe(201);
    expect((response.body as ImageBody).storageKey).toMatch(/^uploads\/avatars\/.+\.jpg$/);
  });

  it.each(['friends', 'private', 'unknown'])('rejects the visibility %s, reserved or unknown', async visibility => {
    const response = await request(e2e.server)
      .post('/v1/images')
      .set('Authorization', e2e.auth('owner'))
      .field('category', 'avatars')
      .field('visibility', visibility)
      .attach('file', await picture('png'), { filename: 'e2e.png', contentType: 'image/png' });
    expect(response.status).toBe(400);
  });

  it('accepts the public visibility', async () => {
    const response = await request(e2e.server)
      .post('/v1/images')
      .set('Authorization', e2e.auth('owner'))
      .field('category', 'avatars')
      .field('visibility', 'public')
      .attach('file', await picture('png'), { filename: 'e2e.png', contentType: 'image/png' });
    expect(response.status).toBe(201);
    expect((response.body as ImageBody).visibility).toBe('public');
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
    expect(updated.storageKey).toBe(`uploads/avatars/${created.id}.jpg`);
    expect(e2e.bucket.has(created.storageKey)).toBe(false);
    expect(e2e.bucket.has(updated.storageKey)).toBe(true);
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

  it('answers 413 to a replacement file larger than the limit', async () => {
    const created = (await upload('owner')).body as ImageBody;
    const response = await request(e2e.server)
      .patch(`/v1/images/${created.id}`)
      .set('Authorization', e2e.auth('owner'))
      .attach('file', Buffer.alloc(UPLOAD_MAX_BYTES + 1, 1), { filename: 'big.png', contentType: 'image/png' });
    expect(response.status).toBe(413);
  });

  it('rejects a reserved visibility in a change', async () => {
    const created = (await upload('owner')).body as ImageBody;
    const response = await request(e2e.server)
      .patch(`/v1/images/${created.id}`)
      .set('Authorization', e2e.auth('owner'))
      .field('visibility', 'private');
    expect(response.status).toBe(400);
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
    expect(e2e.bucket.has(created.storageKey)).toBe(false);
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

describe('chronicle images and scope (spec 102)', () => {
  const GAME = '0b7c1f9e-1234-4abc-8def-0000000000a1';
  const OTHER_GAME = '0b7c1f9e-1234-4abc-8def-0000000000b2';
  const scopeOf = (game: string) => `strategic-game:${game}`;
  const uploadScoped = async (scope: string | undefined, user: 'owner' | 'other' = 'owner') => {
    const test = request(e2e.server).post('/v1/images').set('Authorization', e2e.auth(user)).field('category', 'chronicle');
    if (scope !== undefined) test.field('scope', scope);
    return test.attach('file', await picture('png', 400, 200), { filename: 'map.png', contentType: 'image/png' });
  };
  const listByScope = (scope: string) =>
    request(e2e.server)
      .get('/v1/images')
      .query({ q: `scope==${scope}`, size: 100 })
      .set('Authorization', e2e.auth('owner'));

  it('uploads a chronicle image with its scope, scaled to RMU_MEDIA_CHRONICLE_MAX_WIDTH', async () => {
    const response = await uploadScoped(scopeOf(GAME));
    expect(response.status).toBe(201);
    const image = response.body as ImageBody;
    expect(image).toMatchObject({ category: 'chronicle', scope: scopeOf(GAME), width: 128, height: 64 });
    expect(image.storageKey).toBe(`uploads/chronicle/${image.id}.png`);
  });

  it('leaves the scope out when none is sent, or an empty one', async () => {
    expect((await uploadScoped(undefined)).body as ImageBody).not.toHaveProperty('scope');
    const empty = await uploadScoped('');
    expect(empty.status).toBe(201);
    expect(empty.body as ImageBody).not.toHaveProperty('scope');
  });

  it.each(['campaign:1', `tactical-game:${GAME}`, 'strategic-game:not-a-uuid', GAME])('rejects the scope %s', async scope => {
    const response = await uploadScoped(scope);
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: 'invalid-image-scope' });
  });

  it('filters the listing by scope, which no base image has', async () => {
    const mine = ((await uploadScoped(scopeOf(OTHER_GAME))).body as ImageBody).id;
    const theirs = ((await uploadScoped(scopeOf(OTHER_GAME), 'other')).body as ImageBody).id;
    await uploadScoped(scopeOf(GAME));
    const response = await listByScope(scopeOf(OTHER_GAME));
    expect(response.status).toBe(200);
    expect(ids(response.body).sort()).toEqual([mine, theirs].sort());
    expect((response.body as { content: ImageBody[] }).content.every(image => image.source === 'user')).toBe(true);
  });

  describe('DELETE /v1/images?scope=', () => {
    const GONE = '0b7c1f9e-1234-4abc-8def-0000000000c3';

    it('lets an admin delete every image of the scope, documents and objects', async () => {
      const scoped = [(await uploadScoped(scopeOf(GONE))).body, (await uploadScoped(scopeOf(GONE), 'other')).body] as ImageBody[];
      const kept = (await uploadScoped(scopeOf(GAME))).body as ImageBody;
      const response = await request(e2e.server)
        .delete('/v1/images')
        .query({ scope: scopeOf(GONE) })
        .set('Authorization', e2e.auth('admin'));
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ deleted: 2 });
      expect(ids((await listByScope(scopeOf(GONE))).body)).toEqual([]);
      for (const image of scoped) expect(e2e.bucket.has(image.storageKey)).toBe(false);
      expect(e2e.bucket.has(kept.storageKey)).toBe(true);
      const again = await request(e2e.server)
        .delete('/v1/images')
        .query({ scope: scopeOf(GONE) })
        .set('Authorization', e2e.auth('admin'));
      expect(again.body).toEqual({ deleted: 0 });
    });

    it.each<['owner' | 'noRole']>([['owner'], ['noRole']])('answers 403 to %s and deletes nothing', async user => {
      await uploadScoped(scopeOf(GAME));
      const response = await request(e2e.server)
        .delete('/v1/images')
        .query({ scope: scopeOf(GAME) })
        .set('Authorization', e2e.auth(user));
      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({ code: 'forbidden' });
      expect(ids((await listByScope(scopeOf(GAME))).body).length).toBeGreaterThan(0);
    });

    it('answers 401 without a token', async () => {
      const response = await request(e2e.server)
        .delete('/v1/images')
        .query({ scope: scopeOf(GAME) });
      expect(response.status).toBe(401);
    });

    it.each<[string, Record<string, string>]>([
      ['no scope', {}],
      ['an empty scope', { scope: '' }],
      ['an invalid scope', { scope: 'strategic-game:1' }],
    ])('answers 400 invalid-image-scope to %s', async (_name, query) => {
      const response = await request(e2e.server).delete('/v1/images').query(query).set('Authorization', e2e.auth('admin'));
      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({ code: 'invalid-image-scope', path: '/v1/images' });
    });

    it('keeps DELETE /v1/images/:id working', async () => {
      const created = (await uploadScoped(scopeOf(GAME))).body as ImageBody;
      const response = await request(e2e.server).delete(`/v1/images/${created.id}`).set('Authorization', e2e.auth('owner'));
      expect(response.status).toBe(204);
    });
  });
});
