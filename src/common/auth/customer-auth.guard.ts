import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CustomerPrincipal } from './current-principal';

@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: CustomerPrincipal;
    }>();
    const token = this.extractBearerToken(request.headers.authorization);
    const payload = this.jwtService.verify<CustomerPrincipal>(token);

    if (payload.subjectType !== 'CUSTOMER' || !payload.customerId) {
      throw new UnauthorizedException('Customer token is required.');
    }

    request.user = {
      subjectType: 'CUSTOMER',
      customerId: payload.customerId,
    };

    return true;
  }

  private extractBearerToken(authorization?: string): string {
    const [type, token] = authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Bearer token is required.');
    }

    return token;
  }
}
