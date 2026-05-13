import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { StaffAuthGuard } from '../../../../common/auth/staff-auth.guard';
import { StaffRoles } from '../../../../common/auth/staff-roles.decorator';
import { GetItemProcessEventsUseCase } from '../../application/use-cases/get-item-process-events.use-case';
import { GetItemProcessingUseCase } from '../../application/use-cases/get-item-processing.use-case';

@ApiTags('items')
@ApiBearerAuth()
@UseGuards(StaffAuthGuard)
@StaffRoles('WASH')
@Controller('items')
export class ItemProcessingController {
  constructor(
    private readonly getItemProcessing: GetItemProcessingUseCase,
    private readonly getItemProcessEvents: GetItemProcessEventsUseCase,
  ) {}

  @Get(':id/processing')
  getProcessing(@Param('id') id: string) {
    return this.getItemProcessing.execute(id);
  }

  @Get(':id/processing/events')
  getProcessEvents(@Param('id') id: string) {
    return this.getItemProcessEvents.execute(id);
  }
}
