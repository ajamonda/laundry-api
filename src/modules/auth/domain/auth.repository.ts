import { Customer, Staff, StaffRole } from './auth.types';

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export interface AuthRepository {
  findOrCreateCustomer(customerId: string): Promise<Customer>;
  updateCustomerProfile(input: {
    customerId: string;
    phoneNumber: string;
    address: string;
  }): Promise<Customer>;
  findOrCreateStaff(input: { staffId: string; role: StaffRole }): Promise<Staff>;
}
