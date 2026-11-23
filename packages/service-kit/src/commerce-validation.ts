import { Type } from "class-transformer";
import {orderLabels, type OrderState} from "@ok-family/shared";
import { Transform } from "class-transformer";
import { IsUUID, IsIn, IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";
const trim = ({value}: {value: unknown}) => typeof value === "string" ? value.trim() : value;
export class CartItemDto {
  @IsString() @MaxLength(180) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug!: string;
  @IsInt() @Min(1) @Max(1000) quantity!: number;
  @IsOptional() @IsBoolean() add?: boolean;
}
export class CartSlugDto {
  @IsString() @MaxLength(180) @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) slug!: string;
}
export class AddressDto {
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(80) label!: string;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(120) recipientName!: string;
  @Transform(trim) @IsString() @Matches(/^[0-9 +()-]{7,20}$/) phone!: string;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(180) street!: string;
  @Transform(trim) @IsString() @MinLength(1) @MaxLength(30) number!: string;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(120) neighborhood!: string;
  @Transform(trim) @IsString() @Matches(/^[0-9]{5}$/) postalCode!: string;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(120) city!: string;
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(120) state!: string;
  @IsOptional() @Transform(trim) @IsString() @MaxLength(500) references?: string;
}

export class CheckoutDto {
  @IsUUID() key!: string;
  @IsIn(["pickup","delivery"]) method!: "pickup" | "delivery";
  @IsOptional() @IsUUID() addressId?: string;
  @Matches(/^[a-f0-9]{64}$/) version!: string;
  @IsInt() @Min(1) @Max(2147483647) totalInCents!: number;
}

export class OrderListDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page?: number;
  @IsOptional() @IsIn(Object.keys(orderLabels)) status?: OrderState;
}
export class OrderChangeDto {
  @IsIn(Object.keys(orderLabels)) previous!: OrderState;
  @IsIn(Object.keys(orderLabels)) next!: OrderState;
}
