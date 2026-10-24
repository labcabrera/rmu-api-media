import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../shared/infrastructure/security/auth.module.js';
import { SharedModule } from '../shared/shared.module.js';
import { DeleteImageHandler } from './application/cqrs/handlers/delete-image.handler.js';
import { GetImageImportTaskHandler } from './application/cqrs/handlers/get-image-import-task.handler.js';
import { ImportImagesHandler } from './application/cqrs/handlers/import-images.handler.js';
import { ListImagesHandler } from './application/cqrs/handlers/list-images.handler.js';
import { UpdateImageHandler } from './application/cqrs/handlers/update-image.handler.js';
import { UploadImageHandler } from './application/cqrs/handlers/upload-image.handler.js';
import { ImageImportTaskProcessor } from './application/services/image-import-task.processor.js';
import { MongoImageImportTaskRepository } from './infrastructure/db/mongo.image-import-task.repository.js';
import { MongoImageRepository } from './infrastructure/db/mongo.image.repository.js';
import { ImageImportTaskModel, ImageImportTaskSchema } from './infrastructure/persistence/models/image-import-task.model.js';
import { ImageModel, ImageSchema } from './infrastructure/persistence/models/image.model.js';
import { S3ImageStorageAdapter } from './infrastructure/storage/s3-image-storage.adapter.js';
import { ImageGuardAdapter } from './infrastructure/security/image-guard.adapter.js';
import { ImageController } from './interfaces/http/image.controller.js';

import { IMAGE_IMPORT_TASK_REPOSITORY } from './application/ports/image-import-task-repository.port.js';
import { IMAGE_REPOSITORY } from './application/ports/image-repository.port.js';
import { IMAGE_STORAGE_PORT } from './application/ports/image-storage.port.js';
import { IMAGE_GUARD } from './application/ports/image-guard.port.js';

@Module({
  imports: [
    CqrsModule,
    MongooseModule.forFeature([
      { name: ImageModel.name, schema: ImageSchema },
      { name: ImageImportTaskModel.name, schema: ImageImportTaskSchema },
    ]),
    AuthModule,
    SharedModule,
  ],
  controllers: [ImageController],
  providers: [
    ListImagesHandler,
    GetImageImportTaskHandler,
    ImportImagesHandler,
    UploadImageHandler,
    UpdateImageHandler,
    DeleteImageHandler,
    ImageImportTaskProcessor,
    {
      provide: IMAGE_REPOSITORY,
      useClass: MongoImageRepository,
    },
    {
      provide: IMAGE_IMPORT_TASK_REPOSITORY,
      useClass: MongoImageImportTaskRepository,
    },
    {
      provide: IMAGE_GUARD,
      useClass: ImageGuardAdapter,
    },
    {
      provide: IMAGE_STORAGE_PORT,
      useClass: S3ImageStorageAdapter,
    },
  ],
  exports: [IMAGE_REPOSITORY],
})
export class ImagesModule {}
