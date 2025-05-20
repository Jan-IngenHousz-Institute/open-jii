import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";

import { getSession } from "@repo/auth/express";

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const session = await getSession(request);

    if (!session) {
      throw new UnauthorizedException("Unauthorized");
    }

    request["user"] = session.user;

    return true;
  }
}
