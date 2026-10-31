import Joi from 'joi';

export const envSchema = Joi.object({
  PORT: Joi.number().positive().default(3011),
  LOG_LEVEL: Joi.string().default('info'),
  RMU_MONGO_MEDIA_URI: Joi.string().required(),
  RMU_IAM_URI: Joi.string().uri().default('http://localhost/sso'),
  RMU_IAM_REALM: Joi.string().default('rmu'),
  RMU_IAM_JWK_URI: Joi.string().uri().required(),
  RMU_IAM_ISSUER_URI: Joi.string().uri().required(),
  RMU_IAM_AUDIENCE: Joi.string().required(),
  // HTTP hardening, as in rmu-api-core. No origins: CORS stays off, as the browser comes through the gateway.
  RMU_CORS_ORIGINS: Joi.string().allow('').default(''),
  RMU_THROTTLE_LIMIT: Joi.number().integer().min(0).default(300),
  RMU_THROTTLE_TTL_MS: Joi.number().integer().min(1).default(60_000),
  RMU_TRUST_PROXY: Joi.string().default('loopback, linklocal, uniquelocal'),
  RMU_MEDIA_S3_REGION: Joi.string().required(),
  RMU_MEDIA_S3_BUCKET: Joi.string().required(),
  RMU_MEDIA_S3_BASE_FOLDER: Joi.string().allow('').default(''),
  // Folder of the images under the base folder: uploads go to <image folder>/<category>/ (images in the examples).
  RMU_MEDIA_S3_IMAGE_FOLDER: Joi.string().allow('').default(''),
  RMU_MEDIA_S3_ENDPOINT: Joi.string().uri().optional(),
  RMU_MEDIA_S3_ACCESS_KEY_ID: Joi.string().optional(),
  RMU_MEDIA_S3_SECRET_ACCESS_KEY: Joi.string().optional(),
  RMU_MEDIA_S3_FORCE_PATH_STYLE: Joi.boolean().default(false),
  RMU_MEDIA_IMAGE_MAX_WIDTH: Joi.number().integer().min(1).default(2048),
});
