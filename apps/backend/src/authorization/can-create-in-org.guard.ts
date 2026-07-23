import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UseGuards,
} from "@nestjs/common";
import type { Request } from "express";

import { AuthorizationService } from "./authorization.service";

interface AuthenticatedRequest extends Request {
  session?: { user?: { id?: string } } | null;
}

/**
 * Guards resource creation into a specific organization. When the request body
 * carries an `organizationId`, the caller must be a member of that org;
 * otherwise creation falls back to the caller's personal org (no check needed).
 * Reads the raw parsed body (runs before the oRPC handler), so it only trusts
 * `organizationId` as a string — anything else defers to schema validation.
 */
@Injectable()
export class CanCreateInOrgGuard implements CanActivate {
  private readonly logger = new Logger(CanCreateInOrgGuard.name);

  constructor(private readonly authz: AuthorizationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const body = request.body as { organizationId?: unknown } | undefined;
    const orgId = body?.organizationId;
    // No explicit target org → defaults to the caller's personal org later.
    if (typeof orgId !== "string" || orgId.length === 0) {
      return true;
    }

    const userId = request.session?.user?.id;
    if (!userId) {
      throw new ForbiddenException("Unauthorized");
    }

    const isMember = await this.authz.isOrgMember(userId, orgId);
    if (!isMember) {
      this.logger.warn({
        msg: "Attempt to create a resource in an organization the caller is not a member of",
        operation: "canCreateInOrg",
        organizationId: orgId,
        userId,
      });
      throw new ForbiddenException("You cannot create resources in this organization");
    }
    return true;
  }
}

/** Attach the create-in-org membership guard to a create route. */
export function CanCreateInOrg() {
  return applyDecorators(UseGuards(CanCreateInOrgGuard));
}
