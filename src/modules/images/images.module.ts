import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from 'src/modules/auth/auth.module';
import { SharedModule } from '../shared/shared.module';
import { DeleteImageHandler } from './application/cqrs/handlers/delete-image.handler';
import { ImportImagesFromS3FolderHandler } from './application/cqrs/handlers/import-images-from-s3-folder.handler';
import { ListImagesByCategoryHandler } from './application/cqrs/handlers/list-images-by-category.handler';
import { UpdateImageHandler } from './application/cqrs/handlers/update-image.handler';
import { UploadImageHandler } from './application/cqrs/handlers/upload-image.handler';
import { MongoImageRepository } from './infrastructure/db/mongo.image.repository';
import { ImageModel, ImageSchema } from './infrastructure/persistence/models/image-model';
import { S3ImageStorageAdapter } from './infrastructure/storage/s3-image-storage.adapter';
import { ImageController } from './interfaces/http/image.controller';

@Module({
  imports: [CqrsModule, MongooseModule.forFeature([{ name: ImageModel.name, schema: ImageSchema }]), AuthModule, SharedModule],
  controllers: [ImageController],
  providers: [
    ListImagesByCategoryHandler,
    ImportImagesFromS3FolderHandler,
    UploadImageHandler,
    UpdateImageHandler,
    DeleteImageHandler,
    {
      provide: 'ImageRepository',
      useClass: MongoImageRepository,
    },
    {
      provide: 'ImageStoragePort',
      useClass: S3ImageStorageAdapter,
    },
  ],
  exports: ['ImageRepository'],
})
export class ImagesModule {}
