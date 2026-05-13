import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AuthRepository } from '../domain/auth.repository';
import { Customer, Staff, StaffRole } from '../domain/auth.types';

@Injectable()
export class PrismaAuthRepository implements AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateCustomer(customerId: string): Promise<Customer> {
    return this.prisma.customer.upsert({
      where: { customerId },
      update: {},
      create: { customerId },
    });
  }

  async updateCustomerProfile(input: {
    customerId: string;
    phoneNumber: string;
    address: string;
  }): Promise<Customer> {
    return this.prisma.customer.update({
      where: { customerId: input.customerId },
      data: {
        phoneNumber: input.phoneNumber,
        address: input.address,
      },
    });
  }

  async findOrCreateStaff(input: {
    staffId: string;
    role: StaffRole;
  }): Promise<Staff> {
    return this.prisma.staff.upsert({
      where: { staffId: input.staffId },
      update: { role: input.role },
      create: {
        staffId: input.staffId,
        role: input.role,
      },
    });
  }
}
