import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";

import { validateToken } from "@repo/auth/config";

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException("Authorization header is missing");
    }

    // Check if it's a Bearer token
    if (!authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Invalid token format");
    }

    // Validate the token
    const session = await validateToken(authHeader);

    if (!session) {
      throw new UnauthorizedException("Invalid or expired token");
    }

    // Add the user to the request object so it can be accessed in controllers
    request["user"] = session.user;

    return true;
  }
}
