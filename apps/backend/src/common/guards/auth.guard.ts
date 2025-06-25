import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

import { SessionUser } from "@repo/auth/config";
import { getSession } from "@repo/auth/express";

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user: SessionUser }>();

    const session = await getSession(request);

    if (!session?.user) {
      throw new UnauthorizedException("Unauthorized");
    }

    request.user = session.user as SessionUser;

    return true;
  }
}
