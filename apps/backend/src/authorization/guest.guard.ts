import { HttpException, Injectable } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";

import { AuthorizeGuestUseCase } from "./application/use-cases/authorize-guest/authorize-guest";
import { CAN_ACCESS_KEY, CanAccessGuard } from "./can-access.guard";
import type { CanAccessMetadata } from "./can-access.guard";

interface GuestAwareRequest extends Request {
  session?: {
    user?: { id?: string; isAnonymous?: boolean };
    session?: { token?: string };
  } | null;
}

@Injectable()
export class GuestGuard implements CanActivate {
  constructor(
    private readonly authorize: AuthorizeGuestUseCase,
    private readonly reflector: Reflector,
    private readonly access: CanAccessGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuestAwareRequest>();
    const userId = request.session?.user?.id;
    if (!userId) return true; // Public routes retain their existing anonymous/service guards.
    if (!request.session?.user?.isAnonymous) return true;
    const requirement = this.reflector.getAllAndOverride<CanAccessMetadata | undefined>(
      CAN_ACCESS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const result = await this.authorize.execute({
      userId,
      isAnonymous: true,
      token: request.session.session?.token,
      method: request.method,
      path: request.path,
      hasAccessRequirement: requirement?.guest === true,
    });
    if (result.isFailure()) {
      const error = result.error;
      throw new HttpException({ message: error.message, code: error.code }, error.statusCode);
    }
    return requirement ? this.access.canActivate(context) : true;
  }
}
