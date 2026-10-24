import { envSchema } from '../../../src/config/env.schema.js';

const required = {
  RMU_MONGO_MEDIA_URI: 'mongodb://localhost:27017/rmu-media',
  RMU_IAM_JWK_URI: 'http://localhost:8090/sso/realms/rmu/protocol/openid-connect/certs',
  RMU_IAM_ISSUER_URI: 'http://localhost/sso/realms/rmu',
  RMU_IAM_AUDIENCE: 'rmu-api',
  RMU_MEDIA_S3_REGION: 'eu-west-1',
  RMU_MEDIA_S3_BUCKET: 'rmu-e2e',
};

describe('envSchema', () => {
  it('starts without any Kafka variable [F-media-12]', () => {
    const result = envSchema.validate(required);
    expect(result.error).toBeUndefined();
    expect(Object.keys(result.value as object).some(key => key.startsWith('RMU_KAFKA_'))).toBe(false);
  });

  it('validates the image folder and defaults it to the base folder itself [F-media-11]', () => {
    expect((envSchema.validate(required).value as { RMU_MEDIA_S3_IMAGE_FOLDER: string }).RMU_MEDIA_S3_IMAGE_FOLDER).toBe('');
    const result = envSchema.validate({ ...required, RMU_MEDIA_S3_IMAGE_FOLDER: 'images' });
    expect(result.error).toBeUndefined();
    expect((result.value as { RMU_MEDIA_S3_IMAGE_FOLDER: string }).RMU_MEDIA_S3_IMAGE_FOLDER).toBe('images');
    expect(envSchema.validate({ ...required, RMU_MEDIA_S3_IMAGE_FOLDER: 42 }).error).toBeDefined();
  });
});
