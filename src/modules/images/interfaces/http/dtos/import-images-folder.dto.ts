import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ImportImagesCommand } from 'src/modules/images/application/cqrs/commands/import-images-from-s3-folder.command';
import type { ImportImagesResult } from 'src/modules/images/application/cqrs/handlers/import-images.handler';
import { ImageImportTask } from 'src/modules/images/domain/aggregates/image-import-task';
import type { ImageImportTaskError, ImageImportTaskStatus } from 'src/modules/images/domain/aggregates/image-import-task-props';
import { parseMetadata } from './upload-image.dto';

export class ImportImagesFromS3FolderDto {
  @ApiProperty({ description: 'S3 folder or prefix to scan recursively', example: 'imports/avatars/' })
  @IsString()
  @IsNotEmpty()
  folder: string;

  @ApiPropertyOptional({ description: 'JSON object with extra metadata', example: '{"source":"legacy"}' })
  @IsString()
  @IsOptional()
  metadata?: string;

  static toCommand(dto: ImportImagesFromS3FolderDto, userId: string, userRoles: string[]) {
    return new ImportImagesCommand(dto.folder, parseMetadata(dto.metadata), userId, userRoles);
  }
}

export class ImportImagesResultDto {
  @ApiProperty({ description: 'Import task identifier' })
  taskId: string;

  @ApiProperty({ description: 'Operation status message' })
  message: string;

  static fromResult(result: ImportImagesResult) {
    const dto = new ImportImagesResultDto();
    dto.taskId = result.taskId;
    dto.message = result.message;
    return dto;
  }
}

export class ImageImportTaskDto {
  @ApiProperty({ description: 'Import task identifier' })
  id: string;

  @ApiProperty({ description: 'S3 folder or prefix scanned recursively' })
  folder: string;

  @ApiProperty({ description: 'Task status', enum: ['pending', 'running', 'completed', 'failed'] })
  status: ImageImportTaskStatus;

  @ApiProperty({ description: 'Total S3 objects found' })
  totalObjects: number;

  @ApiProperty({ description: 'Processed S3 objects' })
  processedObjects: number;

  @ApiProperty({ description: 'Imported image identifiers', type: [String] })
  importedImageIds: string[];

  @ApiProperty({ description: 'Existing image identifiers marked as verified', type: [String] })
  verifiedImageIds: string[];

  @ApiProperty({ description: 'Skipped S3 object keys', type: [String] })
  skipped: string[];

  @ApiProperty({ description: 'Import errors', type: [Object] })
  errors: ImageImportTaskError[];

  @ApiProperty({ description: 'Task status message' })
  message: string;

  @ApiProperty({ description: 'Owner user id' })
  owner: string;

  @ApiProperty({ description: 'Task creation date' })
  createdAt: Date;

  @ApiPropertyOptional({ description: 'Task start date' })
  startedAt?: Date;

  @ApiPropertyOptional({ description: 'Task completion date' })
  completedAt?: Date;

  static fromEntity(entity: ImageImportTask) {
    const dto = new ImageImportTaskDto();
    dto.id = entity.id;
    dto.folder = entity.folder;
    dto.status = entity.status;
    dto.totalObjects = entity.totalObjects;
    dto.processedObjects = entity.processedObjects;
    dto.importedImageIds = entity.importedImageIds;
    dto.verifiedImageIds = entity.verifiedImageIds;
    dto.skipped = entity.skipped;
    dto.errors = entity.errors;
    dto.message = entity.message;
    dto.owner = entity.owner;
    dto.createdAt = entity.createdAt;
    dto.startedAt = entity.startedAt;
    dto.completedAt = entity.completedAt;
    return dto;
  }
}
