import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AUTH_REPOSITORY, AuthRepository } from '../../domain/auth.repository';
import { StaffRole } from '../../domain/auth.types';

@Injectable()
export class StaffDevLoginUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY)
    private readonly authRepository: AuthRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(input: { staffId: string; role: StaffRole }) {
    const staff = await this.authRepository.findOrCreateStaff(input);

    return {
      accessToken: this.jwtService.sign({
        subjectType: 'STAFF',
        staffId: staff.staffId,
        staffRole: staff.role,
      }),
      staff: {
        staffId: staff.staffId,
        role: staff.role,
        displayName: staff.displayName,
        phoneNumber: staff.phoneNumber,
      },
    };
  }
}
