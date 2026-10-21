import { HttpException, Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { Request, Response } from "express";

import { AuthorizeGuestUseCase } from "./application/use-cases/authorize-guest/authorize-guest";

interface GuestAwareRequest extends Request {
  session?: {
    user?: { id?: string; isAnonymous?: boolean };
    session?: { token?: string };
  } | null;
}

@Injectable()
export class GuestGuard implements CanActivate {
  constructor(private readonly authorize: AuthorizeGuestUseCase) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuestAwareRequest>();
    const userId = request.session?.user?.id;
    if (!userId) return true; // Public routes retain their existing anonymous/service guards.
    const result = await this.authorize.execute({
      userId,
      token: request.session?.session?.token,
      method: request.method,
      path: request.path,
      body: request.body as unknown,
    });
    if (result.isFailure()) {
      const error = result.error;
      if (
        error.statusCode === 429 &&
        typeof error.details === "object" &&
        error.details !== null &&
        "retryAfterSeconds" in error.details
      ) {
        context
          .switchToHttp()
          .getResponse<Response>()
          .setHeader("Retry-After", String(error.details.retryAfterSeconds));
      }
      throw new HttpException({ message: error.message, code: error.code }, error.statusCode);
    }
    if (result.value.guest && request.session?.user) request.session.user.isAnonymous = true;
    return true;
  }
}
