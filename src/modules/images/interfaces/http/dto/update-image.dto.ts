import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { UpdateImageCommand } from '../../../application/cqrs/commands/update-image.command.js';
import { IMAGE_CATEGORIES } from '../../../domain/entities/image-category.js';
import type { ImageCategory } from '../../../domain/entities/image-category.js';
import { parseMetadata } from './upload-image.dto.js';
import type { UploadedImageFile } from './uploaded-image-file.js';

export class UpdateImageDto {
  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Image file' })
  file?: unknown;

  @ApiPropertyOptional({ type: String, description: 'Image category', enum: IMAGE_CATEGORIES, example: 'avatar' })
  @IsString()
  @IsIn(IMAGE_CATEGORIES)
  @IsOptional()
  category?: ImageCategory;

  @ApiPropertyOptional({ description: 'Alternative text', example: 'Updated portrait' })
  @IsString()
  @IsOptional()
  altText?: string;

  @ApiPropertyOptional({ description: 'JSON object with extra metadata', example: '{"source":"manual"}' })
  @IsString()
  @IsOptional()
  metadata?: string;

  @ApiPropertyOptional({ description: 'Version the client read (from the GET); a different stored version is a 409', example: 3 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  version?: number;

  static toCommand(id: string, dto: UpdateImageDto, file: UploadedImageFile | undefined, userId: string, userRoles: string[]) {
    return new UpdateImageCommand(
      id,
      dto.category,
      file?.buffer,
      file?.mimetype,
      file?.originalname,
      dto.altText,
      parseMetadata(dto.metadata),
      userId,
      userRoles,
      dto.version,
    );
  }
}
