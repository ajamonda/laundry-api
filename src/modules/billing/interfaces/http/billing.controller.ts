import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentCustomer } from '../../../../common/auth/current-customer.decorator';
import { CustomerPrincipal } from '../../../../common/auth/current-principal';
import { CustomerAuthGuard } from '../../../../common/auth/customer-auth.guard';
import { CancelBillingRequestUseCase } from '../../application/use-cases/cancel-billing-request.use-case';
import { GetBillingRequestUseCase } from '../../application/use-cases/get-billing-request.use-case';
import { GetCustomerBillingRequestsUseCase } from '../../application/use-cases/get-customer-billing-requests.use-case';
import { PayBillingRequestUseCase } from '../../application/use-cases/pay-billing-request.use-case';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(CustomerAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(
    private readonly getBillingRequest: GetBillingRequestUseCase,
    private readonly getCustomerBillingRequests: GetCustomerBillingRequestsUseCase,
    private readonly payBillingRequest: PayBillingRequestUseCase,
    private readonly cancelBillingRequest: CancelBillingRequestUseCase,
  ) {}

  @Get('requests')
  listMine(@CurrentCustomer() customer: CustomerPrincipal) {
    return this.getCustomerBillingRequests.execute(customer.customerId);
  }

  @Get('requests/:id')
  get(@CurrentCustomer() customer: CustomerPrincipal, @Param('id') id: string) {
    return this.getBillingRequest.execute({ billingRequestId: id, customerId: customer.customerId });
  }

  @Post('requests/:id/pay')
  pay(@CurrentCustomer() customer: CustomerPrincipal, @Param('id') id: string) {
    return this.payBillingRequest.execute({ billingRequestId: id, customerId: customer.customerId });
  }

  @Post('requests/:id/cancel')
  cancel(@CurrentCustomer() customer: CustomerPrincipal, @Param('id') id: string) {
    return this.cancelBillingRequest.execute({ billingRequestId: id, customerId: customer.customerId });
  }
}
