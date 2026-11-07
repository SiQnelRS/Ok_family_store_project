import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { CatalogQueryDto } from "./validation.js";
import type { ProductType } from "@ok-family/shared";

const trim = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;
export class AdminLoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;
  @IsString() @MinLength(1) @MaxLength(128) password!: string;
}
export class AdminIdDto {
  @IsUUID() id!: string;
}
export class AdminQueryDto extends CatalogQueryDto {
  @IsOptional() @IsIn(["all", "published", "draft", "out"]) status?: string;
}
export class AdminImageDto {
  @IsString()
  @Matches(
    /^(\/images\/[a-zA-Z0-9_-]+\.(?:jpg|jpeg|png|webp)|\/api\/media\/[a-f0-9-]{36}\.webp)$/,
  )
  url!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(200) alt!: string;
}
export class AdminProductDto {
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(180) name!: string;
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  description!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) category!: string;
  @IsIn(["PRODUCTO", "LOTE"]) type!: ProductType;
  @IsInt() @Min(1) @Max(10000) piecesPerUnit!: number;
  @IsInt() @Min(1) @Max(2147483647) priceInCents!: number;
  @IsInt() @Min(0) @Max(1000000) availableQuantity!: number;
  @IsBoolean() published!: boolean;
  @IsBoolean() isDemo!: boolean;
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => AdminImageDto)
  images!: AdminImageDto[];
}
export class AdminUpdateDto extends AdminProductDto {
  @IsDateString() updatedAt!: string;
}
export class AdminDeleteDto {
  @IsDateString() updatedAt!: string;
}
export class AdminUploadDto {
  @IsIn(["image/jpeg", "image/png", "image/webp"]) contentType!: string;
  @IsString()
  @MaxLength(5592408)
  @Matches(/^[A-Za-z0-9+/]+={0,2}$/)
  data!: string;
}
