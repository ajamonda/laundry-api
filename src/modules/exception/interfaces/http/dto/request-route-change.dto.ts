import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class RequestRouteChangeDto {
  @IsString()
  toRouteCode!: string;

  @IsOptional()
  @IsInt()
  additionalCost?: number;

  @IsString()
  @MinLength(1)
  reason!: string;
}
