import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export const ISSUE_TYPES = [
  'REWASH_REQUIRED',
  'DAMAGE_RISK',
  'STAIN_REMOVAL_FAILED',
  'ADDITIONAL_REPAIR_REQUIRED',
  'ADDITIONAL_VENDOR_REQUIRED',
  'PAYMENT_PENDING',
] as const;

export class RaiseIssueDto {
  @ApiProperty({
    example: 'REPAIR_REQUIRED',
    enum: ISSUE_TYPES,
    description: '이슈 유형',
  })
  @IsIn(ISSUE_TYPES)
  issueType!: string;

  @ApiPropertyOptional({ example: '소매 이음새 뜯김 발견', description: '상세 메모' })
  @IsOptional()
  @IsString()
  note?: string;
}
