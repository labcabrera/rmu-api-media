import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../shared/infrastructure/security/auth.module';
import { SharedModule } from '../shared/shared.module';
import { DeleteImageHandler } from './application/cqrs/handlers/delete-image.handler';
import { GetImageImportTaskHandler } from './application/cqrs/handlers/get-image-import-task.handler';
import { ImportImagesHandler } from './application/cqrs/handlers/import-images.handler';
import { ListImagesHandler } from './application/cqrs/handlers/list-images.handler';
import { UpdateImageHandler } from './application/cqrs/handlers/update-image.handler';
import { UploadImageHandler } from './application/cqrs/handlers/upload-image.handler';
import { ImageImportTaskProcessor } from './application/services/image-import-task.processor';
import { MongoImageImportTaskRepository } from './infrastructure/db/mongo.image-import-task.repository';
import { MongoImageRepository } from './infrastructure/db/mongo.image.repository';
import { ImageImportTaskModel, ImageImportTaskSchema } from './infrastructure/persistence/models/image-import-task.model';
import { ImageModel, ImageSchema } from './infrastructure/persistence/models/image.model';
import { S3ImageStorageAdapter } from './infrastructure/storage/s3-image-storage.adapter';
import { ImageController } from './interfaces/http/image.controller';

import { IMAGE_IMPORT_TASK_REPOSITORY } from './application/ports/image-import-task-repository.port';
import { IMAGE_REPOSITORY } from './application/ports/image-repository.port';
import { IMAGE_STORAGE_PORT } from './application/ports/image-storage.port';
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
      provide: IMAGE_STORAGE_PORT,
      useClass: S3ImageStorageAdapter,
    },
  ],
  exports: [IMAGE_REPOSITORY],
})
export class ImagesModule {}
