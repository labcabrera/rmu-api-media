import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from 'src/modules/auth/auth.module';
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
import { ImageImportTaskModel, ImageImportTaskSchema } from './infrastructure/persistence/models/image-import-task-model';
import { ImageModel, ImageSchema } from './infrastructure/persistence/models/image-model';
import { S3ImageStorageAdapter } from './infrastructure/storage/s3-image-storage.adapter';
import { ImageController } from './interfaces/http/image.controller';

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
      provide: 'ImageRepository',
      useClass: MongoImageRepository,
    },
    {
      provide: 'ImageImportTaskRepository',
      useClass: MongoImageImportTaskRepository,
    },
    {
      provide: 'ImageStoragePort',
      useClass: S3ImageStorageAdapter,
    },
  ],
  exports: ['ImageRepository'],
})
export class ImagesModule {}
