import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { StaffPrincipal } from './current-principal';

export const CurrentStaff = createParamDecorator(
  (_data: unknown, context: ExecutionContext): StaffPrincipal => {
    const request = context.switchToHttp().getRequest<{
      user: StaffPrincipal;
    }>();

    return request.user;
  },
);
