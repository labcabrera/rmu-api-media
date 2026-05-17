import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose/dist/common/mongoose.decorators';
import { Model } from 'mongoose';
import { ImageImportTaskRepository } from 'src/modules/images/application/ports/image-import-task-repository';
import { ImageImportTask } from 'src/modules/images/domain/aggregates/image-import-task';
import { MongoBaseRepository } from 'src/modules/shared/infrastructure/db/mongo.base.repository';
import { RsqlParser } from 'src/modules/shared/infrastructure/persistence/repositories/rsql-parser';
import { ImageImportTaskDocument, ImageImportTaskModel } from '../persistence/models/image-import-task-model';

@Injectable()
export class MongoImageImportTaskRepository
  extends MongoBaseRepository<ImageImportTask, ImageImportTaskDocument>
  implements ImageImportTaskRepository
{
  constructor(@InjectModel(ImageImportTaskModel.name) taskModel: Model<ImageImportTaskDocument>, rsqlParser: RsqlParser) {
    super(taskModel, rsqlParser);
  }

  protected mapToEntity(doc: ImageImportTaskDocument): ImageImportTask {
    return ImageImportTask.fromProps({
      id: doc.id as string,
      folder: doc.folder,
      status: doc.status,
      totalObjects: doc.totalObjects,
      processedObjects: doc.processedObjects,
      importedImageIds: doc.importedImageIds,
      verifiedImageIds: doc.verifiedImageIds,
      skipped: doc.skipped,
      errors: doc.errors,
      message: doc.message,
      owner: doc.owner,
      createdAt: doc.createdAt,
      startedAt: doc.startedAt,
      completedAt: doc.completedAt,
      updatedAt: doc.updatedAt,
    });
  }
}
