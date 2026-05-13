import { Body, Controller, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentCustomer } from '../../../../common/auth/current-customer.decorator';
import { CustomerAuthGuard } from '../../../../common/auth/customer-auth.guard';
import { CustomerPrincipal } from '../../../../common/auth/current-principal';
import { CompleteCustomerProfileUseCase } from '../../application/use-cases/complete-customer-profile.use-case';
import { CustomerDevLoginUseCase } from '../../application/use-cases/customer-dev-login.use-case';
import { StaffDevLoginUseCase } from '../../application/use-cases/staff-dev-login.use-case';
import { StaffRole } from '../../domain/auth.types';
import { CompleteCustomerProfileRequestDto } from './dto/complete-customer-profile.dto';
import { CustomerDevLoginRequestDto } from './dto/customer-dev-login.dto';
import { StaffDevLoginRequestDto } from './dto/staff-dev-login.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly customerDevLoginUseCase: CustomerDevLoginUseCase,
    private readonly completeCustomerProfileUseCase: CompleteCustomerProfileUseCase,
    private readonly staffDevLoginUseCase: StaffDevLoginUseCase,
  ) {}

  @Post('customer/dev-login')
  customerDevLogin(@Body() body: CustomerDevLoginRequestDto) {
    return this.customerDevLoginUseCase.execute(body.customerId);
  }

  @ApiBearerAuth()
  @UseGuards(CustomerAuthGuard)
  @Patch('customer/me/profile')
  completeCustomerProfile(
    @CurrentCustomer() customer: CustomerPrincipal,
    @Body() body: CompleteCustomerProfileRequestDto,
  ) {
    return this.completeCustomerProfileUseCase.execute({
      customerId: customer.customerId,
      phoneNumber: body.phoneNumber,
      address: body.address,
    });
  }

  @Post('staff/pickup/dev-login')
  pickupStaffDevLogin(@Body() body: StaffDevLoginRequestDto) {
    return this.staffDevLogin(body.staffId, 'PICKUP');
  }

  @Post('staff/wash/dev-login')
  washStaffDevLogin(@Body() body: StaffDevLoginRequestDto) {
    return this.staffDevLogin(body.staffId, 'WASH');
  }

  @Post('staff/delivery/dev-login')
  deliveryStaffDevLogin(@Body() body: StaffDevLoginRequestDto) {
    return this.staffDevLogin(body.staffId, 'DELIVERY');
  }

  @Post('staff/admin/dev-login')
  adminStaffDevLogin(@Body() body: StaffDevLoginRequestDto) {
    return this.staffDevLogin(body.staffId, 'ADMIN');
  }

  private staffDevLogin(staffId: string, role: StaffRole) {
    return this.staffDevLoginUseCase.execute({ staffId, role });
  }
}
