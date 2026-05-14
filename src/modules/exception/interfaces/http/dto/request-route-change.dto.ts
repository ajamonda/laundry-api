import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class RouteChangeRepairOptionDto {
  @IsString()
  @MinLength(1)
  optionCode!: string;

  @IsOptional()
  @IsString()
  inputValue?: string;
}

export class RequestRouteChangeDto {
  @IsString()
  toRouteCode!: string;

  @IsOptional()
  @IsInt()
  additionalCost?: number;

  @IsString()
  @MinLength(1)
  reason!: string;

  /**
   * Repair option selections the staff made on the request screen. Required only
   * when the destination route has a repair phase; omitted otherwise. Replayed
   * by ApproveRouteChangeUseCase to rebuild `OrderItemOption(group=repair)`
   * rows on approval. ArrayMaxSize is a sanity cap, not a business rule.
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(32)
  @ValidateNested({ each: true })
  @Type(() => RouteChangeRepairOptionDto)
  repairOptions?: RouteChangeRepairOptionDto[];
}
