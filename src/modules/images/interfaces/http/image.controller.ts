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
import { ApiBody, ApiConsumes, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../shared/infrastructure/security/jwt-auth.guard.js';
import { ApiErrors } from '../../../shared/interfaces/http/api-errors.decorator.js';
import type { AuthenticatedUser } from '../../../shared/interfaces/http/authenticated-request.js';
import { CurrentUser } from '../../../shared/interfaces/http/current-user.decorator.js';
import { DeleteImageCommand } from '../../application/cqrs/commands/delete-image.command.js';
import { UpdateImageCommand } from '../../application/cqrs/commands/update-image.command.js';
import { UploadImageCommand } from '../../application/cqrs/commands/upload-image.command.js';
import { ListImagesQuery } from '../../application/cqrs/queries/list-images.query.js';
import { Image } from '../../domain/aggregates/image.js';
import { Page } from '../../../shared/application/pagination/page.js';
import { PagedQueryDto } from '../../../shared/interfaces/http/dto/paged-rsql-query.js';
import { ImageDto, ImagePageDto } from './dto/image.dto.js';
import { UpdateImageDto } from './dto/update-image.dto.js';
import type { UploadedImageFile } from './dto/uploaded-image-file.js';
import { UploadImageDto } from './dto/upload-image.dto.js';

@UseGuards(JwtAuthGuard)
@Controller('v1/images')
@ApiTags('Images')
export class ImageController {
  constructor(
    private commandBus: CommandBus,
    private queryBus: QueryBus,
  ) {}

  @Get('')
  @ApiOperation({
    operationId: 'findImagesByCategory',
    summary: 'Find images',
    description: 'RSQL search over the image fields, for example `q=category==avatars`',
  })
  @ApiOkResponse({ type: ImagePageDto, description: 'Success' })
  @ApiErrors({ 400: 'Bad request, invalid search or page' })
  async find(@Query() dto: PagedQueryDto, @CurrentUser() user: AuthenticatedUser) {
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
  @ApiCreatedResponse({ type: ImageDto, description: 'Image uploaded' })
  @ApiErrors({ 400: 'Bad request, invalid data', 403: 'The user cannot upload images (rmu-user or rmu-admin)' })
  async upload(@Body() dto: UploadImageDto, @UploadedFile() file: UploadedImageFile, @CurrentUser() user: AuthenticatedUser) {
    this.assertImageFile(file, true);
    const command = UploadImageDto.toCommand(dto, file, user.id, user.roles);
    const image = await this.commandBus.execute<UploadImageCommand, Image>(command);
    return ImageDto.fromEntity(image);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UpdateImageDto })
  @ApiOperation({ operationId: 'updateImage', summary: 'Update image metadata or content' })
  @ApiOkResponse({ type: ImageDto, description: 'Success' })
  @ApiErrors({ 404: 'Image not found', 400: 'Bad request, invalid data', 403: 'Only the owner or an administrator', 409: 'Stale version' })
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
  @ApiNoContentResponse({ description: 'Image deleted' })
  @ApiErrors({ 404: 'Image not found', 403: 'Only the owner or an administrator' })
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
