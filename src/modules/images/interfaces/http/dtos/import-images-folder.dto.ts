import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ImportImagesCommand } from 'src/modules/images/application/cqrs/commands/import-images-from-s3-folder.command';
import type { ImportImagesResult } from 'src/modules/images/application/cqrs/handlers/import-images-from-s3-folder.handler';
import { IMAGE_CATEGORIES } from 'src/modules/images/domain/entities/image-category';
import type { ImageCategory } from 'src/modules/images/domain/entities/image-category';
import { ImageDto } from './image.dto';
import { parseMetadata } from './upload-image.dto';

export class ImportImagesFromS3FolderDto {
  @ApiProperty({ description: 'S3 folder or prefix to scan recursively', example: 'imports/avatars/' })
  @IsString()
  @IsNotEmpty()
  folder: string;

  @ApiProperty({ description: 'Category to assign to imported images', enum: IMAGE_CATEGORIES, example: 'avatar' })
  @IsString()
  @IsIn(IMAGE_CATEGORIES)
  category: ImageCategory;

  @ApiPropertyOptional({ description: 'JSON object with extra metadata', example: '{"source":"legacy"}' })
  @IsString()
  @IsOptional()
  metadata?: string;

  static toCommand(dto: ImportImagesFromS3FolderDto, userId: string, userRoles: string[]) {
    return new ImportImagesCommand(dto.folder, parseMetadata(dto.metadata), userId, userRoles);
  }
}

export class ImportImagesResultDto {
  @ApiProperty({ description: 'Imported images', type: [ImageDto] })
  imported: ImageDto[];

  @ApiProperty({ description: 'Skipped S3 object keys', type: [String] })
  skipped: string[];

  @ApiProperty({ description: 'Number of imported images' })
  importedCount: number;

  @ApiProperty({ description: 'Number of skipped objects' })
  skippedCount: number;

  static fromResult(result: ImportImagesResult) {
    const dto = new ImportImagesResultDto();
    dto.imported = result.imported.map(image => ImageDto.fromEntity(image));
    dto.skipped = result.skipped;
    dto.importedCount = result.imported.length;
    dto.skippedCount = result.skipped.length;
    return dto;
  }
}
