import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { MulterModule } from '@nestjs/platform-express';
import { AuthModule } from '../shared/infrastructure/security/auth.module.js';
import { SharedModule } from '../shared/shared.module.js';
import { DeleteImageHandler } from './application/cqrs/handlers/delete-image.handler.js';
import { GetImageHandler } from './application/cqrs/handlers/get-image.handler.js';
import { ListImagesHandler } from './application/cqrs/handlers/list-images.handler.js';
import { UpdateImageHandler } from './application/cqrs/handlers/update-image.handler.js';
import { UploadImageHandler } from './application/cqrs/handlers/upload-image.handler.js';
import { MongoImageRepository } from './infrastructure/db/mongo.image.repository.js';
import { ImageModel, ImageSchema } from './infrastructure/persistence/models/image.model.js';
import { HttpBaseImageCatalogAdapter } from './infrastructure/catalog/http-base-image-catalog.adapter.js';
import { S3ImageStorageAdapter } from './infrastructure/storage/s3-image-storage.adapter.js';
import { ImageGuardAdapter } from './infrastructure/security/image-guard.adapter.js';
import { ImageController } from './interfaces/http/image.controller.js';

import { IMAGE_REPOSITORY } from './application/ports/image-repository.port.js';
import { IMAGE_STORAGE_PORT } from './application/ports/image-storage.port.js';
import { IMAGE_GUARD } from './application/ports/image-guard.port.js';
import { BASE_IMAGE_CATALOG } from './application/ports/base-image-catalog.port.js';

@Module({
  imports: [
    CqrsModule,
    MongooseModule.forFeature([{ name: ImageModel.name, schema: ImageSchema }]),
    // Limits of every FileInterceptor of the module: a larger file is a 413 (spec 057, decision 9).
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        limits: { fileSize: Number(config.get<number>('RMU_MEDIA_UPLOAD_MAX_BYTES') ?? 10_485_760), files: 1 },
      }),
    }),
    AuthModule,
    SharedModule,
  ],
  controllers: [ImageController],
  providers: [
    ListImagesHandler,
    GetImageHandler,
    UploadImageHandler,
    UpdateImageHandler,
    DeleteImageHandler,
    {
      provide: IMAGE_REPOSITORY,
      useClass: MongoImageRepository,
    },
    {
      provide: IMAGE_GUARD,
      useClass: ImageGuardAdapter,
    },
    {
      provide: BASE_IMAGE_CATALOG,
      useClass: HttpBaseImageCatalogAdapter,
    },
    {
      provide: IMAGE_STORAGE_PORT,
      useClass: S3ImageStorageAdapter,
    },
  ],
  exports: [IMAGE_REPOSITORY],
})
export class ImagesModule {}
