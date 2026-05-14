import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentCustomer } from '../../../../common/auth/current-customer.decorator';
import { CurrentStaff } from '../../../../common/auth/current-staff.decorator';
import { CustomerPrincipal, StaffPrincipal } from '../../../../common/auth/current-principal';
import { CustomerAuthGuard } from '../../../../common/auth/customer-auth.guard';
import { StaffAuthGuard } from '../../../../common/auth/staff-auth.guard';
import { StaffRoles } from '../../../../common/auth/staff-roles.decorator';
import { ApproveRouteChangeUseCase } from '../../application/use-cases/approve-route-change.use-case';
import { GetPendingRouteChangeRequestsUseCase } from '../../application/use-cases/get-pending-route-change-requests.use-case';
import { RejectRouteChangeUseCase } from '../../application/use-cases/reject-route-change.use-case';
import { RequestRouteChangeUseCase } from '../../application/use-cases/request-route-change.use-case';
import { RequestRouteChangeDto } from './dto/request-route-change.dto';

@ApiTags('exception')
@ApiBearerAuth()
@Controller('wash')
export class RouteChangeController {
  constructor(
    private readonly requestRouteChange: RequestRouteChangeUseCase,
    private readonly approveRouteChange: ApproveRouteChangeUseCase,
    private readonly rejectRouteChange: RejectRouteChangeUseCase,
    private readonly getPendingRequests: GetPendingRouteChangeRequestsUseCase,
  ) {}

  @ApiOperation({ summary: '경로 변경 요청 (스태프)', description: '고객 승인이 필요한 경로 변경을 요청합니다.' })
  @UseGuards(StaffAuthGuard)
  @StaffRoles('WASH')
  @Post('items/:id/request-route-change')
  requestChange(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('id') id: string,
    @Body() body: RequestRouteChangeDto,
  ) {
    return this.requestRouteChange.execute({
      itemId: id,
      toRouteCode: body.toRouteCode,
      additionalCost: body.additionalCost,
      reason: body.reason,
      repairOptions: body.repairOptions,
      actor: { actorType: 'STAFF', actorId: staff.staffId, staffRole: staff.staffRole },
    });
  }

  @ApiOperation({ summary: '경로 변경 요청 목록 (고객)', description: 'PENDING 상태의 경로 변경 요청 목록을 반환합니다.' })
  @UseGuards(CustomerAuthGuard)
  @Get('route-change-requests/pending')
  listPending(@CurrentCustomer() customer: CustomerPrincipal) {
    return this.getPendingRequests.execute(customer.customerId);
  }

  @ApiOperation({ summary: '경로 변경 승인 (고객)' })
  @UseGuards(CustomerAuthGuard)
  @Post('route-change-requests/:id/approve')
  approve(
    @CurrentCustomer() customer: CustomerPrincipal,
    @Param('id') id: string,
  ) {
    return this.approveRouteChange.execute({
      routeChangeRequestId: id,
      customerId: customer.customerId,
    });
  }

  @ApiOperation({ summary: '경로 변경 거절 (고객)' })
  @UseGuards(CustomerAuthGuard)
  @Post('route-change-requests/:id/reject')
  reject(
    @CurrentCustomer() customer: CustomerPrincipal,
    @Param('id') id: string,
  ) {
    return this.rejectRouteChange.execute({
      routeChangeRequestId: id,
      customerId: customer.customerId,
    });
  }
}
