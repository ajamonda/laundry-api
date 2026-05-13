import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';

const DECISIONS = [
  'APPROVE_REPAIR',
  'APPROVE_VENDOR',
  'APPROVE_PREMIUM',
  'CLEAN_WITHOUT_REPAIR',
  'APPROVE_AS_IS',
  'RETURN_WITHOUT_PROCESSING',
] as const;

export class RespondApprovalDto {
  @ApiProperty({
    example: 'APPROVE_REPAIR',
    enum: DECISIONS,
    description: '고객 결정',
  })
  @IsString()
  decision!: string;

  @ApiPropertyOptional({
    example: 15000,
    description: '추가/환불 금액 (APPROVE_* 결정 시. 양수=추가 청구, 음수=환불, 단위: 원)',
  })
  @IsOptional()
  @IsNumber()
  extraAmount?: number;
}
