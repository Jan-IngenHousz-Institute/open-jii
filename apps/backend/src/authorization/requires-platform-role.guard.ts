import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UseGuards,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import type { PlatformRole } from "@repo/database";

import { AuthorizationService } from "./authorization.service";

const PLATFORM_ROLE_KEY = "requiredPlatformRole";

interface AuthenticatedRequest extends Request {
  session?: { user?: { id?: string } } | null;
}

/** Personal API keys authenticate through this header, and none carries a platform role. */
export function isApiKeyRequest(request: Request): boolean {
  return request.headers["x-api-key"] !== undefined;
}

/** Guards a route that only holders of one platform role may call. */
@Injectable()
export class RequiresPlatformRoleGuard implements CanActivate {
  constructor(
    private readonly authz: AuthorizationService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const role = this.reflector.getAllAndOverride<PlatformRole | undefined>(PLATFORM_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.session?.user?.id;
    if (
      !role ||
      !userId ||
      isApiKeyRequest(request) ||
      !(await this.authz.hasPlatformRole(userId, role))
    ) {
      throw new ForbiddenException("Platform role required");
    }
    return true;
  }
}

/** Attach the platform role guard to a route or a whole controller. */
export function RequiresPlatformRole(role: PlatformRole) {
  return applyDecorators(
    SetMetadata(PLATFORM_ROLE_KEY, role),
    UseGuards(RequiresPlatformRoleGuard),
  );
}
