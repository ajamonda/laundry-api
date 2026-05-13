import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { EstimateItemInputDto } from './pricing-estimate.dto';

export class OrderItemInputDto {
  @ApiProperty({ example: 'characteristics_text' })
  @IsString()
  @IsNotEmpty()
  inputCode!: string;

  @ApiProperty({ example: '스웨이드 재질, 앞코 얼룩 있음' })
  @IsString()
  @IsNotEmpty()
  inputValue!: string;
}

export class CreateOrderItemDto extends EstimateItemInputDto {
  @ApiPropertyOptional({ type: [OrderItemInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  inputs?: OrderItemInputDto[];

  @ApiPropertyOptional({ example: ['https://example.com/photo.jpg'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];
}

export class CreateOrderRequestDto {
  @ApiProperty({ example: 'customer-1' })
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @ApiPropertyOptional({ example: '2026-05-11T09:00:00.000Z' })
  @IsOptional()
  @IsString()
  pickupSchedule?: string;

  @ApiPropertyOptional({ enum: ['DELIVERY', 'STORAGE'] })
  @IsOptional()
  @IsIn(['DELIVERY', 'STORAGE'])
  fulfillmentType?: 'DELIVERY' | 'STORAGE';

  @ApiPropertyOptional({ example: 'regular_delivery' })
  @IsOptional()
  @IsString()
  fulfillmentOptionCode?: string;

  @ApiPropertyOptional({ example: '서울시 강남구 테헤란로 1' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: '010-0000-0000' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'front_door' })
  @IsOptional()
  @IsString()
  pickupDeliveryPlaceCode?: string;

  @ApiPropertyOptional({ example: '공동현관 안쪽' })
  @IsOptional()
  @IsString()
  pickupDeliveryPlaceText?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  secondHandPickupRequested?: boolean;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}
