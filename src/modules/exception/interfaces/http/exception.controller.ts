import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentCustomer } from '../../../../common/auth/current-customer.decorator';
import { CurrentStaff } from '../../../../common/auth/current-staff.decorator';
import { CustomerPrincipal, StaffPrincipal } from '../../../../common/auth/current-principal';
import { CustomerAuthGuard } from '../../../../common/auth/customer-auth.guard';
import { StaffAuthGuard } from '../../../../common/auth/staff-auth.guard';
import { StaffRoles } from '../../../../common/auth/staff-roles.decorator';
import { ActivateExceptionFlowUseCase } from '../../application/use-cases/activate-exception-flow.use-case';
import { GetCustomerApprovalRequestsUseCase } from '../../application/use-cases/get-customer-approval-requests.use-case';
import { RaiseIssueUseCase } from '../../application/use-cases/raise-issue.use-case';
import { RespondApprovalUseCase } from '../../application/use-cases/respond-approval.use-case';
import { ActivateExceptionFlowDto } from './dto/activate-exception-flow.dto';
import { RaiseIssueDto } from './dto/raise-issue.dto';
import { RespondApprovalDto } from './dto/respond-approval.dto';

@ApiTags('exception')
@ApiBearerAuth()
@Controller('wash')
export class ExceptionController {
  constructor(
    private readonly raiseIssue: RaiseIssueUseCase,
    private readonly activateExceptionFlow: ActivateExceptionFlowUseCase,
    private readonly respondApproval: RespondApprovalUseCase,
    private readonly getApprovalRequests: GetCustomerApprovalRequestsUseCase,
  ) {}

  @ApiOperation({ summary: '이슈 등록', description: '아이템에 이슈를 기록합니다. 처리 상태는 변경되지 않습니다.' })
  @ApiResponse({
    status: 201,
    description: '이슈 등록 성공',
    schema: {
      example: {
        id: 'issue-uuid',
        orderItemId: 'order-item-uuid',
        issueType: 'REPAIR_REQUIRED',
        note: '소매 이음새 뜯김 발견',
        raisedBy: 'staff-1',
        createdAt: '2026-05-11T11:00:00.000Z',
      },
    },
  })
  @UseGuards(StaffAuthGuard)
  @StaffRoles('WASH')
  @Post('items/:id/raise-issue')
  raiseItemIssue(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('id') id: string,
    @Body() body: RaiseIssueDto,
  ) {
    return this.raiseIssue.execute({
      itemId: id,
      issueType: body.issueType,
      note: body.note ?? null,
      actor: { actorType: 'STAFF', actorId: staff.staffId, staffRole: staff.staffRole },
    });
  }

  @ApiOperation({ summary: '예외 흐름 활성화', description: '아이템에 예외 흐름을 삽입합니다. 고객 승인이 필요한 흐름은 approval_request가 생성됩니다.' })
  @ApiResponse({
    status: 201,
    description: '예외 흐름 활성화 성공 — 현재 처리 상태 반환',
    schema: {
      example: {
        orderItemId: 'order-item-uuid',
        planId: 'plan-uuid',
        routeCode: 'GENERAL_CLOTHES_CLEANING',
        currentStepSource: 'OVERRIDE',
        currentStep: {
          stepId: 'override-uuid',
          stepType: 'REPAIR_ESTIMATE',
          displayName: '수선 견적',
          sortOrder: 110,
          status: 'IN_PROGRESS',
        },
        nextStep: { stepType: 'REQUEST_CUSTOMER_APPROVAL', displayName: '고객 수선 승인 요청', sortOrder: 120 },
        isPlanCompleted: false,
      },
    },
  })
  @ApiResponse({ status: 404, description: '존재하지 않는 flowCode' })
  @ApiResponse({ status: 409, description: '아이템 상태가 SORTED 또는 PROCESSING이 아님' })
  @UseGuards(StaffAuthGuard)
  @StaffRoles('WASH')
  @Post('items/:id/activate-exception-flow')
  activateFlow(
    @CurrentStaff() staff: StaffPrincipal,
    @Param('id') id: string,
    @Body() body: ActivateExceptionFlowDto,
  ) {
    return this.activateExceptionFlow.execute({
      itemId: id,
      flowCode: body.flowCode,
      additionalCost: body.additionalCost,
      actor: { actorType: 'STAFF', actorId: staff.staffId, staffRole: staff.staffRole },
    });
  }

  @ApiOperation({ summary: '내 승인 요청 목록', description: '로그인 고객의 WAITING 상태 승인 요청을 반환합니다. 소켓 재연결 시 missed event 복원에 사용합니다.' })
  @ApiResponse({
    status: 200,
    description: '승인 요청 목록',
    schema: {
      example: [
        {
          approvalRequestId: 'approval-uuid',
          flowCode: 'REPAIR_APPROVAL_FLOW',
          itemId: 'order-item-uuid',
          options: [
            { stepType: 'REPAIR_ESTIMATE', displayName: '수선 견적', offset: 10 },
            { stepType: 'WAIT_CUSTOMER_DECISION', displayName: '고객 응답 대기', offset: 30 },
          ],
          status: 'WAITING',
          createdAt: '2026-05-11T11:00:00.000Z',
        },
      ],
    },
  })
  @UseGuards(CustomerAuthGuard)
  @Get('approval-requests')
  listMyApprovalRequests(@CurrentCustomer() customer: CustomerPrincipal) {
    return this.getApprovalRequests.execute(customer.customerId);
  }

  @ApiOperation({ summary: '승인 요청 응답', description: '고객이 예외 흐름에 대한 결정을 제출합니다.' })
  @ApiResponse({ status: 200, description: '응답 처리 완료' })
  @ApiResponse({ status: 404, description: '승인 요청을 찾을 수 없음' })
  @ApiResponse({ status: 409, description: '이미 처리된 승인 요청' })
  @ApiResponse({ status: 403, description: '본인의 승인 요청이 아님' })
  @UseGuards(CustomerAuthGuard)
  @Post('approval-requests/:id/respond')
  respondToApproval(
    @CurrentCustomer() customer: CustomerPrincipal,
    @Param('id') id: string,
    @Body() body: RespondApprovalDto,
  ) {
    return this.respondApproval.execute({
      approvalRequestId: id,
      decision: body.decision,
      extraAmount: body.extraAmount,
      customerId: customer.customerId,
    });
  }
}
