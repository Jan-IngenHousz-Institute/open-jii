import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Request } from "express";
import { z } from "zod";

import type { ResourceAction } from "@repo/auth/access";
import type { ResourceType } from "@repo/database";

import { AuthorizationService } from "./authorization.service";

/** Reflector metadata key holding the `@CanAccess` requirement for a route. */
export const CAN_ACCESS_KEY = "can-access";

export interface CanAccessMetadata {
  resource: ResourceType;
  action: ResourceAction;
  /** Route param holding the resource id. Defaults to "id". */
  param?: string;
}

/** Request shape after the global Better Auth `AuthGuard` has populated it. */
interface AuthenticatedRequest extends Request {
  session?: { user?: { id?: string } } | null;
}

/**
 * Declarative per-resource authorization. Reads the `@CanAccess` requirement
 * from route metadata, resolves the target resource id from the route params,
 * and delegates the decision to `AuthorizationService.can()`. Runs after the
 * global `AuthGuard` (which sets `request.session`), so the caller is known.
 *
 * Denials throw Nest HTTP exceptions (403 forbidden, 404 not-found) — the same
 * mechanism the global auth guard uses for 401 — rather than oRPC errors, which
 * are only formatted inside the handler pipeline.
 */
@Injectable()
export class CanAccessGuard implements CanActivate {
  private readonly logger = new Logger(CanAccessGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly authz: AuthorizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<CanAccessMetadata | undefined>(CAN_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // No requirement declared on this route → nothing to enforce here.
    if (!meta) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.session?.user?.id;
    if (!userId) {
      // Should be unreachable behind the global AuthGuard, but fail closed.
      throw new ForbiddenException("Unauthorized");
    }

    const param = meta.param ?? "id";
    const rawId = request.params[param];
    const resourceId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!resourceId) {
      this.logger.error({
        msg: "CanAccess: route is missing the resource-id param",
        operation: "canAccess",
        param,
        path: request.path,
      });
      throw new ForbiddenException("Forbidden");
    }
    if (!z.string().uuid().safeParse(resourceId).success) {
      throw new BadRequestException(`Invalid ${param}`);
    }

    const decision = await this.authz.can(userId, {
      resourceType: meta.resource,
      resourceId,
      action: meta.action,
    });

    if (!decision.allow) {
      this.logger.warn({
        msg: "Access denied",
        operation: "canAccess",
        resourceType: meta.resource,
        resourceId,
        action: meta.action,
        userId,
        reason: decision.reason,
      });
      // Hide existence of resources the caller can't see.
      if (decision.reason === "not-found") {
        throw new NotFoundException(`${meta.resource} with ID ${resourceId} not found`);
      }
      throw new ForbiddenException(`You cannot ${meta.action} this ${meta.resource}`);
    }

    return true;
  }
}
