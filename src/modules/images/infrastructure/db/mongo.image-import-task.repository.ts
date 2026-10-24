import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ImageImportTaskRepository } from '../../application/ports/image-import-task-repository';
import { ImageImportTask } from '../../domain/aggregates/image-import-task';
import { MongoBaseRepository } from '../../../shared/infrastructure/db/mongo.base.repository';
import { RsqlParser } from '../../../shared/infrastructure/persistence/repositories/rsql-parser';
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
      id: doc.id,
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
