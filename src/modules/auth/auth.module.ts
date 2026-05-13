import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../../database/prisma.module';
import { CompleteCustomerProfileUseCase } from './application/use-cases/complete-customer-profile.use-case';
import { CustomerDevLoginUseCase } from './application/use-cases/customer-dev-login.use-case';
import { StaffDevLoginUseCase } from './application/use-cases/staff-dev-login.use-case';
import { AUTH_REPOSITORY } from './domain/auth.repository';
import { PrismaAuthRepository } from './infrastructure/prisma-auth.repository';
import { AuthController } from './interfaces/http/auth.controller';

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    CustomerDevLoginUseCase,
    CompleteCustomerProfileUseCase,
    StaffDevLoginUseCase,
    {
      provide: AUTH_REPOSITORY,
      useClass: PrismaAuthRepository,
    },
  ],
  exports: [JwtModule],
})
export class AuthModule {}
