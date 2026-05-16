/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/modules/auth/jwt.auth.guard';
import { DeleteImageCommand } from '../../application/cqrs/commands/delete-image.command';
import { UpdateImageCommand } from '../../application/cqrs/commands/update-image.command';
import { UploadImageCommand } from '../../application/cqrs/commands/upload-image.command';
import { ListImagesByCategoryQuery } from '../../application/cqrs/queries/list-images-by-category.query';
import { Image } from '../../domain/aggregates/image';
import { IMAGE_CATEGORIES } from '../../domain/entities/image-category';
import type { ImageCategory } from '../../domain/entities/image-category';
import { Page } from 'src/modules/shared/domain/entities/page';
import { ErrorDto } from 'src/modules/shared/interfaces/http/dto/error-dto';
import { PagedQueryDto } from 'src/modules/shared/interfaces/http/dto/paged-rsql-query';
import { ImageDto, ImagePageDto } from './dtos/image.dto';
import { ImportImagesFromS3FolderDto, ImportImagesResultDto as ImportImagesResultDto } from './dtos/import-images-folder.dto';
import { UpdateImageDto } from './dtos/update-image.dto';
import type { UploadedImageFile } from './dtos/uploaded-image-file';
import { UploadImageDto } from './dtos/upload-image.dto';
import { ImportImagesCommand } from '../../application/cqrs/commands/import-images-from-s3-folder.command';
import { ImportImagesResult } from '../../application/cqrs/handlers/import-images-from-s3-folder.handler';

@UseGuards(JwtAuthGuard)
@Controller('v1/images')
@ApiTags('Images')
export class ImageController {
  constructor(
    private commandBus: CommandBus,
    private queryBus: QueryBus,
  ) {}

  @Get('category/:category')
  @ApiOperation({ operationId: 'findImagesByCategory', summary: 'Find images by category' })
  @ApiOkResponse({ type: ImagePageDto, description: 'Success' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing authentication token', type: ErrorDto })
  async findByCategory(@Param('category') category: ImageCategory, @Query() dto: PagedQueryDto) {
    if (!IMAGE_CATEGORIES.includes(category)) throw new BadRequestException('Invalid image category');
    const query = new ListImagesByCategoryQuery(category, dto.page, dto.size);
    const page = await this.queryBus.execute<ListImagesByCategoryQuery, Page<Image>>(query);
    const mapped = page.content.map(image => ImageDto.fromEntity(image));
    return new Page<ImageDto>(mapped, page.pagination.page, page.pagination.size, page.pagination.totalElements);
  }

  @Post('')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadImageDto })
  @ApiOperation({ operationId: 'uploadImage', summary: 'Upload a new image' })
  @ApiOkResponse({ type: ImageDto, description: 'Success' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing authentication token', type: ErrorDto })
  @ApiResponse({ status: 400, description: 'Bad request, invalid data', type: ErrorDto })
  async upload(@Body() dto: UploadImageDto, @UploadedFile() file: UploadedImageFile, @Request() req) {
    this.assertImageFile(file, true);
    const user = req.user!;
    const command = UploadImageDto.toCommand(dto, file, user.id as string, user.roles as string[]);
    const image = await this.commandBus.execute<UploadImageCommand, Image>(command);
    return ImageDto.fromEntity(image);
  }

  @Post('import/s3-folder')
  @ApiBody({ type: ImportImagesFromS3FolderDto })
  @ApiOperation({ operationId: 'importImagesFromS3Folder', summary: 'Import images from an S3 folder' })
  @ApiOkResponse({ type: ImportImagesResultDto, description: 'Success' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing authentication token', type: ErrorDto })
  @ApiResponse({ status: 400, description: 'Bad request, invalid data', type: ErrorDto })
  async importFromS3Folder(@Body() dto: ImportImagesFromS3FolderDto, @Request() req) {
    const user = req.user!;
    const command = ImportImagesFromS3FolderDto.toCommand(dto, user.id as string, user.roles as string[]);
    const result = await this.commandBus.execute<ImportImagesCommand, ImportImagesResult>(command);
    return ImportImagesResultDto.fromResult(result);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateImageDto })
  @ApiOperation({ operationId: 'updateImage', summary: 'Update image metadata or content' })
  @ApiOkResponse({ type: ImageDto, description: 'Success' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing authentication token', type: ErrorDto })
  @ApiNotFoundResponse({ description: 'Image not found', type: ErrorDto })
  @ApiResponse({ status: 400, description: 'Bad request, invalid data', type: ErrorDto })
  async update(@Param('id') id: string, @Body() dto: UpdateImageDto, @UploadedFile() file: UploadedImageFile | undefined, @Request() req) {
    this.assertImageFile(file, false);
    const user = req.user!;
    const command = UpdateImageDto.toCommand(id, dto, file, user.id as string, user.roles as string[]);
    const image = await this.commandBus.execute<UpdateImageCommand, Image>(command);
    return ImageDto.fromEntity(image);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ operationId: 'deleteImage', summary: 'Delete image by id' })
  @ApiUnauthorizedResponse({ description: 'Invalid or missing authentication token', type: ErrorDto })
  @ApiNotFoundResponse({ description: 'Image not found', type: ErrorDto })
  async delete(@Param('id') id: string, @Request() req) {
    const user = req.user!;
    const command = new DeleteImageCommand(id, user.id as string, user.roles as string[]);
    await this.commandBus.execute(command);
  }

  private assertImageFile(file: UploadedImageFile | undefined, required: boolean) {
    if (!file && required) throw new BadRequestException('Image file is required');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) throw new BadRequestException('Unsupported image content type');
  }
}
