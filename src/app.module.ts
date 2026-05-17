import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import Joi from 'joi';
import { SharedModule } from './modules/shared/shared.module';
import { ImagesModule } from './modules/images/images.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        PORT: Joi.number().positive().default(3011),
        RMU_MONGO_MEDIA_URI: Joi.string().required(),
        RMU_IAM_JWK_URI: Joi.string().uri().required(),
        RMU_IAM_TOKEN_URI: Joi.string().uri().required(),
        RMU_IAM_CLIENT_ID: Joi.string().required(),
        RMU_IAM_CLIENT_SECRET: Joi.string().required(),
        RMU_KAFKA_BROKERS: Joi.string().required(),
        RMU_KAFKA_CLIENT_ID: Joi.string().required(),
        RMU_KAFKA_DEFAULT_PARTITIONS: Joi.number().integer().min(1).default(1),
        RMU_MEDIA_S3_REGION: Joi.string().required(),
        RMU_MEDIA_S3_BUCKET: Joi.string().required(),
        RMU_MEDIA_S3_BASE_FOLDER: Joi.string().allow('').default(''),
        RMU_MEDIA_S3_ENDPOINT: Joi.string().uri().optional(),
        RMU_MEDIA_S3_PUBLIC_BASE_URL: Joi.string().uri().optional(),
        RMU_MEDIA_S3_ACCESS_KEY_ID: Joi.string().optional(),
        RMU_MEDIA_S3_SECRET_ACCESS_KEY: Joi.string().optional(),
        RMU_MEDIA_S3_FORCE_PATH_STYLE: Joi.boolean().default(false),
        RMU_MEDIA_IMAGE_MAX_WIDTH: Joi.number().integer().min(1).default(2048),
        RMU_MEDIA_IMAGE_IMPORT_PARALLELISM: Joi.number().integer().min(1).default(4),
        RMU_MEDIA_IMAGE_IMPORT_BATCH_SIZE: Joi.number().integer().min(1).default(50),
      }),
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('RMU_MONGO_MEDIA_URI'),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    SharedModule,
    ImagesModule,
  ],
})
export class AppModule {}
