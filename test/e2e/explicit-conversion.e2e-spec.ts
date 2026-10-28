import sharp from 'sharp';
import request from 'supertest';
import { startApp, type E2eApp } from './support/app.js';

// Spec 044, fallo 10: the validation pipe no longer converts the body before validating it, and the query values
// (page, size) and the multipart version are converted explicitly.
describe('Explicit conversion (e2e)', () => {
  let e2e: E2eApp;

  beforeAll(async () => {
    e2e = await startApp();
  });

  afterAll(async () => {
    await e2e?.stop();
  });

  const upload = async () => {
    const png = await sharp({ create: { width: 20, height: 10, channels: 3, background: { r: 0, g: 0, b: 0 } } })
      .png()
      .toBuffer();
    const response = await request(e2e.server)
      .post('/v1/images')
      .set('Authorization', e2e.auth('owner'))
      .field('category', 'avatars')
      .attach('file', png, { filename: 'e2e.png', contentType: 'image/png' })
      .expect(201);
    return response.body as { id: string; version: number };
  };

  describe('body', () => {
    it('answers 400 to a number in a string field of a JSON body', async () => {
      const auth = e2e.auth('admin');
      const folder = await request(e2e.server).post('/v1/images/import').set('Authorization', auth).send({ folder: 42 }).expect(400);
      expect(folder.body).toMatchObject({ statusCode: 400, path: '/v1/images/import' });
      await request(e2e.server).post('/v1/images/import').set('Authorization', auth).send({ folder: 'images', metadata: 42 }).expect(400);
    });

    it('answers 400 to a number in a string field of a JSON update', async () => {
      const image = await upload();
      await request(e2e.server).patch(`/v1/images/${image.id}`).set('Authorization', e2e.auth('owner')).send({ altText: 42 }).expect(400);
    });

    it('reads the version of a multipart update as a number, and rejects one that is not', async () => {
      const image = await upload();
      const auth = e2e.auth('owner');
      await request(e2e.server).patch(`/v1/images/${image.id}`).set('Authorization', auth).field('version', 'abc').expect(400);
      const updated = await request(e2e.server)
        .patch(`/v1/images/${image.id}`)
        .set('Authorization', auth)
        .field('altText', 'Changed')
        .field('version', String(image.version))
        .expect(200);
      expect(updated.body).toMatchObject({ altText: 'Changed', version: image.version + 1 });
    });
  });

  describe('query', () => {
    it('pages a listing from the query string', async () => {
      await upload();
      await upload();
      await upload();
      const auth = e2e.auth('owner');
      const first = await request(e2e.server).get('/v1/images?page=0&size=20').set('Authorization', auth).expect(200);
      const total = (first.body as { pagination: { totalElements: number } }).pagination.totalElements;
      expect(total).toBeGreaterThanOrEqual(3);
      expect(first.body).toMatchObject({ pagination: { page: 0, size: 20 } });
      const second = await request(e2e.server)
        .get(`/v1/images?page=1&size=${total - 1}`)
        .set('Authorization', auth)
        .expect(200);
      expect(second.body).toMatchObject({ pagination: { page: 1, size: total - 1, totalElements: total } });
      expect((second.body as { content: unknown[] }).content).toHaveLength(1);
    });

    it.each(['page=abc', 'size=1.5'])('answers 400 to a non-integer %s', async query => {
      await request(e2e.server).get(`/v1/images?${query}`).set('Authorization', e2e.auth('owner')).expect(400);
    });
  });
});
