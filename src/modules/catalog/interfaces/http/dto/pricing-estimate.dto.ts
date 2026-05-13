import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class EstimateSelectedOptionDto {
  @ApiProperty({ example: 'cleaning_method' })
  @IsString()
  @IsNotEmpty()
  groupCode!: string;

  @ApiProperty({ example: 'regular_wash' })
  @IsString()
  @IsNotEmpty()
  optionCode!: string;

  @ApiPropertyOptional({ example: '스웨이드 재질, 앞코 얼룩 있음' })
  @IsOptional()
  @IsString()
  inputValue?: string;

  @ApiPropertyOptional({ example: 3.5 })
  @IsOptional()
  @IsNumber()
  quantity?: number;
}

export class EstimateItemInputDto {
  @ApiProperty({ example: 'ugg_boots' })
  @IsString()
  @IsNotEmpty()
  itemCode!: string;

  @ApiProperty({ type: [EstimateSelectedOptionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EstimateSelectedOptionDto)
  options!: EstimateSelectedOptionDto[];
}

export class PricingEstimateRequestDto {
  @ApiProperty({ type: [EstimateItemInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EstimateItemInputDto)
  items!: EstimateItemInputDto[];
}
