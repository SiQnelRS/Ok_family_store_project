import { Transform } from "class-transformer";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
export class CustomerLoginDto {
  @Transform(({value}: {value: unknown}) => typeof value === "string" ? value.trim().toLowerCase() : value)
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(1) @MaxLength(128) password!: string;
}
export class CustomerRegisterDto extends CustomerLoginDto {
  @Transform(({value}: {value: unknown}) => typeof value === "string" ? value.trim() : value)
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsString() @MinLength(12) @MaxLength(128) declare password: string;
}

export class CustomerProfileDto {
  @Transform(({value}: {value: unknown}) => typeof value === "string" ? value.trim() : value)
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
}
export class CustomerPasswordDto {
  @IsString() @MinLength(1) @MaxLength(128) currentPassword!: string;
  @IsString() @MinLength(12) @MaxLength(128) newPassword!: string;
}
