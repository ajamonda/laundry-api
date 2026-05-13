import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { StaffRole } from '../../modules/auth/domain/auth.types';
import { CurrentPrincipal, StaffPrincipal } from './current-principal';
import { STAFF_ROLES_KEY } from './staff-roles.decorator';

@Injectable()
export class StaffAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: CurrentPrincipal;
    }>();
    const token = this.extractBearerToken(request.headers.authorization);
    const payload = this.jwtService.verify<StaffPrincipal>(token);

    if (
      payload.subjectType !== 'STAFF' ||
      !payload.staffId ||
      !payload.staffRole
    ) {
      throw new UnauthorizedException('Staff token is required.');
    }

    const principal: StaffPrincipal = {
      subjectType: 'STAFF',
      staffId: payload.staffId,
      staffRole: payload.staffRole,
    };
    this.assertRoleAllowed(context, principal.staffRole);
    request.user = principal;

    return true;
  }

  private assertRoleAllowed(context: ExecutionContext, role: StaffRole): void {
    const allowedRoles =
      this.reflector.getAllAndOverride<StaffRole[]>(STAFF_ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (allowedRoles.length === 0) {
      return;
    }

    if (role === 'ADMIN' || allowedRoles.includes(role)) {
      return;
    }

    throw new ForbiddenException('Staff role is not allowed.');
  }

  private extractBearerToken(authorization?: string): string {
    const [type, token] = authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Bearer token is required.');
    }

    return token;
  }
}
