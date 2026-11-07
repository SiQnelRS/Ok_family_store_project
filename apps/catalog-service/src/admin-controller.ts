import {
  Body,
  Controller,
  Delete,
  Get,
  Module,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  AdminGuard,
  AdminIdDto,
  AdminProductDto,
  AdminUpdateDto,
  AdminDeleteDto,
  AdminQueryDto,
  AdminUploadDto,
  serviceUrl,
} from "@ok-family/service-kit";
import type { AdminRequest } from "@ok-family/service-kit";
import { AdminCatalogRepository } from "./admin-repository.js";
import { MediaController, savePhoto } from "./admin-media.js";

@Controller("admin/products")
@UseGuards(AdminGuard)
class AdminProductsController {
  constructor(private readonly repository: AdminCatalogRepository) {}
  @Get() list(@Query() query: AdminQueryDto) {
    return this.repository.list(query);
  }
  @Get(":id") detail(@Param() params: AdminIdDto) {
    return this.repository.detail(params.id);
  }
  @Post() create(@Body() input: AdminProductDto, @Req() request: AdminRequest) {
    return this.repository.create(input, request.admin.id);
  }
  @Patch(":id") update(
    @Param() params: AdminIdDto,
    @Body() input: AdminUpdateDto,
    @Req() request: AdminRequest,
  ) {
    return this.repository.update(params.id, input, request.admin.id);
  }
  @Delete(":id") remove(
    @Param() params: AdminIdDto,
    @Body() input: AdminDeleteDto,
    @Req() request: AdminRequest,
  ) {
    return this.repository.remove(params.id, input.updatedAt, request.admin.id);
  }
}
@Controller("admin/images")
@UseGuards(AdminGuard)
class AdminImagesController {
  @Post() upload(@Body() input: AdminUploadDto) {
    return savePhoto(input);
  }
}

@Module({
  controllers: [
    AdminProductsController,
    AdminImagesController,
    MediaController,
  ],
  providers: [
    AdminCatalogRepository,
    AdminGuard,
    {
      provide: "ADMIN_AUTH_URL",
      useFactory: () => serviceUrl("AUTH_SERVICE_URL", "http://127.0.0.1:4001"),
    },
  ],
})
export class AdminCatalogModule {}
