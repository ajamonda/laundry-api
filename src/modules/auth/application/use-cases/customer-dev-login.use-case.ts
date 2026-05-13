import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AUTH_REPOSITORY, AuthRepository } from '../../domain/auth.repository';
import { CustomerProfilePolicy } from '../../domain/customer-profile.policy';

@Injectable()
export class CustomerDevLoginUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY)
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(customerId: string) {
    const customer = await this.authRepository.findOrCreateCustomer(customerId);
    const missingFields = CustomerProfilePolicy.getMissingFields(customer);

    return {
      accessToken: this.jwtService.sign({
        subjectType: 'CUSTOMER',
        customerId: customer.customerId,
      }),
      customer: {
        customerId: customer.customerId,
        phoneNumber: customer.phoneNumber,
        address: customer.address,
      },
      requiresProfileCompletion: missingFields.length > 0,
      missingFields,
    };
  }
}
