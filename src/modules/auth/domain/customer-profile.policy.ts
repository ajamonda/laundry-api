import { Customer, CustomerMissingProfileField } from './auth.types';

export class CustomerProfilePolicy {
  static getMissingFields(customer: Customer): CustomerMissingProfileField[] {
    const missingFields: CustomerMissingProfileField[] = [];

    if (!customer.phoneNumber) {
      missingFields.push('phoneNumber');
    }

    if (!customer.address) {
      missingFields.push('address');
    }

    return missingFields;
  }
}
