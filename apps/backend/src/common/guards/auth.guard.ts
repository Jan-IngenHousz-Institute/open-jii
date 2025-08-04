import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

import { getSession } from "@repo/auth/express";
import type { User } from "@repo/auth/types";

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user: User }>();

    const session = await getSession(request);

    if (!session?.user) {
      throw new UnauthorizedException("Unauthorized");
    }

    request.user = session.user;

    return true;
  }
}
