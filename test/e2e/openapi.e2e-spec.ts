import request from 'supertest';
import { startApp, type E2eApp } from './support/app.js';

// The published OpenAPI document (/api-spec), in a file of its own: AppModule reads the environment once per file.
describe('OpenAPI', () => {
  type Operation = { security?: unknown[]; parameters?: { name: string; in: string }[]; responses: Record<string, unknown> };
  type Spec = {
    paths: Record<string, Record<string, Operation>>;
    components: { schemas: Record<string, { properties: Record<string, unknown> }> };
  };
  let e2e: E2eApp;
  let spec: Spec;

  beforeAll(async () => {
    e2e = await startApp();
    spec = (await request(e2e.server).get('/api-spec')).body as Spec;
  });

  afterAll(async () => {
    await e2e?.stop();
  });

  it('documents the health check without security and the rest with it', () => {
    expect(spec.paths['/v1/health'].get.security).toBeUndefined();
    expect(spec.paths['/v1/images'].get.security).toEqual([{ oauth2: [], 'access-token': [] }]);
  });

  it('documents the search of images without a category path parameter [F-media-02]', () => {
    const names = (spec.paths['/v1/images'].get.parameters ?? []).map(parameter => `${parameter.in}:${parameter.name}`);
    expect(names).not.toContain('path:category');
    expect(names).toEqual(expect.arrayContaining(['query:q', 'query:page', 'query:size']));
  });

  it('documents the page content as an array of images [F-media-03]', () => {
    expect(spec.components.schemas.ImagePageDto.properties.content).toEqual({
      type: 'array',
      description: 'Images',
      items: { $ref: '#/components/schemas/ImageDto' },
    });
  });

  it('documents the success status of each operation', () => {
    expect(Object.keys(spec.paths['/v1/images'].post.responses)).toContain('201');
    expect(Object.keys(spec.paths['/v1/images/{id}'].delete.responses)).toContain('204');
  });

  it('gives the error examples of this API [F-receta-22]', () => {
    expect(JSON.stringify(spec.components.schemas.ErrorDto)).toContain('/v1/images/');
    expect(JSON.stringify(spec.components.schemas.ErrorDto)).not.toContain('races');
  });
});
