import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { CustomerPrincipal } from './current-principal';

export const CurrentCustomer = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CustomerPrincipal => {
    const request = context.switchToHttp().getRequest<{
      user: CustomerPrincipal;
    }>();

    return request.user;
  },
);
