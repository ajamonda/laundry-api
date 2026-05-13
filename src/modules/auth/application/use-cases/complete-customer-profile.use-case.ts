import { Inject, Injectable } from '@nestjs/common';
import { AUTH_REPOSITORY, AuthRepository } from '../../domain/auth.repository';
import { CustomerProfilePolicy } from '../../domain/customer-profile.policy';

@Injectable()
export class CompleteCustomerProfileUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY)
    private readonly authRepository: AuthRepository,
  ) {}

  async execute(input: {
    customerId: string;
    phoneNumber: string;
    address: string;
  }) {
    const customer = await this.authRepository.updateCustomerProfile(input);
    const missingFields = CustomerProfilePolicy.getMissingFields(customer);

    return {
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
