import { Transform, Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
export class AdminCustomerQueryDto {
  @IsOptional() @Transform(({value}: {value: unknown}) => typeof value === "string" ? value.trim() : value)
  @IsString() @MaxLength(100) q?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) page = 1;
}
export class AdminCustomerStatusDto {
  @IsBoolean() active!: boolean;
  @IsBoolean() expectedActive!: boolean;
}
