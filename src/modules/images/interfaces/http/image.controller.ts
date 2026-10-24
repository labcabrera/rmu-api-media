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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiAcceptedResponse, ApiConsumes, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../shared/infrastructure/security/jwt-auth.guard';
import { ApiErrors } from '../../../shared/interfaces/http/api-errors.decorator';
import type { AuthenticatedUser } from '../../../shared/interfaces/http/authenticated-request';
import { CurrentUser } from '../../../shared/interfaces/http/current-user.decorator';
import { DeleteImageCommand } from '../../application/cqrs/commands/delete-image.command';
import { UpdateImageCommand } from '../../application/cqrs/commands/update-image.command';
import { UploadImageCommand } from '../../application/cqrs/commands/upload-image.command';
import { ListImagesQuery } from '../../application/cqrs/queries/list-images.query';
import { Image } from '../../domain/aggregates/image';
import type { ImageCategory } from '../../domain/entities/image-category';
import { Page } from '../../../shared/application/pagination/page';
import { PagedQueryDto } from '../../../shared/interfaces/http/dto/paged-rsql-query';
import { ImageDto, ImagePageDto } from './dto/image.dto';
import {
  ImageImportTaskDto,
  ImportImagesFromS3FolderDto,
  ImportImagesResultDto as ImportImagesResultDto,
} from './dto/import-images-folder.dto';
import { UpdateImageDto } from './dto/update-image.dto';
import type { UploadedImageFile } from './dto/uploaded-image-file';
import { UploadImageDto } from './dto/upload-image.dto';
import { ImportImagesCommand } from '../../application/cqrs/commands/import-images-from-s3-folder.command';
import { ImportImagesResult } from '../../application/cqrs/handlers/import-images.handler';
import { GetImageImportTaskQuery } from '../../application/cqrs/queries/get-image-import-task.query';
import { ImageImportTask } from '../../domain/aggregates/image-import-task';

@UseGuards(JwtAuthGuard)
@Controller('v1/images')
@ApiTags('Images')
export class ImageController {
  constructor(
    private commandBus: CommandBus,
    private queryBus: QueryBus,
  ) {}

  @Get('')
  @ApiOperation({ operationId: 'findImagesByCategory', summary: 'Find images by category' })
  @ApiOkResponse({ type: ImagePageDto, description: 'Success' })
  @ApiErrors()
  async findByCategory(@Param('category') category: ImageCategory, @Query() dto: PagedQueryDto, @CurrentUser() user: AuthenticatedUser) {
    const userId = user.id;
    const roles = user.roles;
    const query = new ListImagesQuery(dto.q || '', dto.page, dto.size, userId, roles);
    const page = await this.queryBus.execute<ListImagesQuery, Page<Image>>(query);
    const mapped = page.content.map(image => ImageDto.fromEntity(image));
    return new Page<ImageDto>(mapped, page.pagination.page, page.pagination.size, page.pagination.totalElements);
  }

  @Post('')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadImageDto })
  @ApiOperation({ operationId: 'uploadImage', summary: 'Upload a new image' })
  @ApiOkResponse({ type: ImageDto, description: 'Success' })
  @ApiErrors({ 400: 'Bad request, invalid data' })
  async upload(@Body() dto: UploadImageDto, @UploadedFile() file: UploadedImageFile, @CurrentUser() user: AuthenticatedUser) {
    this.assertImageFile(file, true);
    const command = UploadImageDto.toCommand(dto, file, user.id, user.roles);
    const image = await this.commandBus.execute<UploadImageCommand, Image>(command);
    return ImageDto.fromEntity(image);
  }

  @Post('import')
  @ApiBody({ type: ImportImagesFromS3FolderDto })
  @ApiOperation({ operationId: 'importImages', summary: 'Import images' })
  @ApiAcceptedResponse({ type: ImportImagesResultDto, description: 'Import task accepted' })
  @ApiErrors({ 400: 'Bad request, invalid data' })
  @HttpCode(202)
  async importFromS3Folder(@Body() dto: ImportImagesFromS3FolderDto, @CurrentUser() user: AuthenticatedUser) {
    const command = ImportImagesFromS3FolderDto.toCommand(dto, user.id, user.roles);
    const result = await this.commandBus.execute<ImportImagesCommand, ImportImagesResult>(command);
    return ImportImagesResultDto.fromResult(result);
  }

  @Get('import/:taskId')
  @ApiOperation({ operationId: 'getImageImportTask', summary: 'Get image import task result' })
  @ApiOkResponse({ type: ImageImportTaskDto, description: 'Success' })
  @ApiErrors({ 404: 'Image import task not found' })
  async getImportTask(@Param('taskId') taskId: string, @CurrentUser() user: AuthenticatedUser) {
    const query = new GetImageImportTaskQuery(taskId, user.id, user.roles);
    const task = await this.queryBus.execute<GetImageImportTaskQuery, ImageImportTask>(query);
    return ImageImportTaskDto.fromEntity(task);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateImageDto })
  @ApiOperation({ operationId: 'updateImage', summary: 'Update image metadata or content' })
  @ApiOkResponse({ type: ImageDto, description: 'Success' })
  @ApiErrors({ 404: 'Image not found', 400: 'Bad request, invalid data' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateImageDto,
    @UploadedFile() file: UploadedImageFile | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    this.assertImageFile(file, false);
    const command = UpdateImageDto.toCommand(id, dto, file, user.id, user.roles);
    const image = await this.commandBus.execute<UpdateImageCommand, Image>(command);
    return ImageDto.fromEntity(image);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ operationId: 'deleteImage', summary: 'Delete image by id' })
  @ApiErrors({ 404: 'Image not found' })
  async delete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    const command = new DeleteImageCommand(id, user.id, user.roles);
    await this.commandBus.execute(command);
  }

  private assertImageFile(file: UploadedImageFile | undefined, required: boolean) {
    if (!file && required) throw new BadRequestException('Image file is required');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) throw new BadRequestException('Unsupported image content type');
  }
}
