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

type TaskBody = { status: string; importedImageIds: string[]; verifiedImageIds: string[]; skipped: string[]; errors: unknown[] };

const counts = (task: TaskBody) => ({
  status: task.status,
  imported: task.importedImageIds.length,
  verified: task.verifiedImageIds.length,
  skipped: task.skipped.length,
});

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

  // F-media-06: no endpoint checks the roles, so a token without groups lists, uploads and deletes images.
  it('lets a user without roles list the images', async () => {
    const response = await request(e2e.server).get('/v1/images').set('Authorization', e2e.auth('noRole'));
    expect(response.status).toBe(200);
  });

  it.skip('rejects an upload from a user without roles [F-media-06]', async () => {
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
    expect((rejected.body as { code: string }).code).toBe('bad-request');
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

  // F-media-07: the new category only changes the metadata: the stored object keeps the key of the old category.
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

  // F-media-06: the handlers do not check the owner.
  it('lets another user change an image', async () => {
    const created = (await upload('owner')).body as ImageBody;
    const response = await request(e2e.server)
      .patch(`/v1/images/${created.id}`)
      .set('Authorization', e2e.auth('other'))
      .field('altText', 'Not mine');
    expect(response.status).toBe(200);
  });

  it.skip('rejects a change from another user [F-media-06]', async () => {
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

  // F-media-06
  it('lets another user delete an image', async () => {
    const created = (await upload('owner')).body as ImageBody;
    const response = await request(e2e.server).delete(`/v1/images/${created.id}`).set('Authorization', e2e.auth('other'));
    expect(response.status).toBe(204);
  });

  it.skip('rejects a deletion from another user [F-media-06]', async () => {
    const created = (await upload('owner')).body as ImageBody;
    const response = await request(e2e.server).delete(`/v1/images/${created.id}`).set('Authorization', e2e.auth('other'));
    expect(response.status).toBe(403);
  });
});

describe('import from S3', () => {
  const waitForTask = async (taskId: string): Promise<TaskBody> => {
    for (let attempt = 0; attempt < 50; attempt++) {
      const response = await request(e2e.server).get(`/v1/images/import/${taskId}`).set('Authorization', e2e.auth('admin'));
      const task = response.body as TaskBody;
      if (task.status === 'completed' || task.status === 'failed') return task;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`Import task ${taskId} did not finish`);
  };

  const importFolder = async (folder: string) => {
    const response = await request(e2e.server).post('/v1/images/import').set('Authorization', e2e.auth('admin')).send({ folder });
    expect(response.status).toBe(202);
    return waitForTask((response.body as { taskId: string }).taskId);
  };

  it('registers the images of a folder once, taking the category from the parent folder', async () => {
    const png = await picture('png');
    e2e.bucket.set(`${BASE_FOLDER}/images/backgrounds/forest.png`, { body: png, contentType: 'image/png' });
    e2e.bucket.set(`${BASE_FOLDER}/images/backgrounds/notes.txt`, { body: Buffer.from('x'), contentType: 'text/plain' });

    const first = await importFolder('images/backgrounds');
    expect(counts(first)).toMatchObject({ status: 'completed', imported: 1, skipped: 1, verified: 0 });

    const list = await request(e2e.server).get('/v1/images').query({ q: 'category==backgrounds' }).set('Authorization', e2e.auth('admin'));
    const images = (list.body as { content: ImageBody[] }).content;
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ storageKey: 'images/backgrounds/forest.png', verified: true, owner: 'e2e-admin' });

    const second = await importFolder('images/backgrounds');
    expect(counts(second)).toMatchObject({ status: 'completed', imported: 0, verified: 1 });
  });

  // F-media-09: the category of an imported image is the parent folder name, without checking it is a category.
  it('stores the parent folder as category even when it is not one', async () => {
    e2e.bucket.set(`${BASE_FOLDER}/images/unknown-folder/a.png`, { body: await picture('png'), contentType: 'image/png' });
    const task = await importFolder('images/unknown-folder');
    expect(counts(task).imported).toBe(1);
    const list = await request(e2e.server)
      .get('/v1/images')
      .query({ q: 'category==unknown-folder' })
      .set('Authorization', e2e.auth('admin'));
    expect(ids(list.body)).toHaveLength(1);
  });

  it('answers 404 to an unknown task', async () => {
    const response = await request(e2e.server).get('/v1/images/import/unknown').set('Authorization', e2e.auth('admin'));
    expect(response.status).toBe(404);
  });

  // F-media-06: importing a whole folder is open to any user.
  it.skip('rejects an import from a user that is not admin [F-media-06]', async () => {
    const response = await request(e2e.server).post('/v1/images/import').set('Authorization', e2e.auth('owner')).send({ folder: 'images' });
    expect(response.status).toBe(403);
  });
});
