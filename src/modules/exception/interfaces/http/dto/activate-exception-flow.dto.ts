import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

const FLOW_CODES = [
  'REPAIR_APPROVAL_FLOW',
  'VENDOR_APPROVAL_FLOW',
  'PREMIUM_APPROVAL_FLOW',
  'DAMAGE_RISK_APPROVAL_FLOW',
  'STAIN_REMOVAL_FAILED_FLOW',
  'REWASH_FLOW',
  'ADDITIONAL_REPAIR_FLOW',
  'ADDITIONAL_VENDOR_FLOW',
  'PAYMENT_RETRY_FLOW',
  'PAYMENT_PENDING_FLOW',
  'RETURN_WITHOUT_PROCESSING_FLOW',
] as const;

export class ActivateExceptionFlowDto {
  @ApiProperty({
    example: 'REPAIR_APPROVAL_FLOW',
    enum: FLOW_CODES,
    description: '예외 흐름 코드',
  })
  @IsString()
  flowCode!: string;

  @ApiPropertyOptional({ example: 15000, description: '추가 수선/외주 비용 (원). 고객 승인 요청 시 함께 전달됩니다.' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  additionalCost?: number;
}
