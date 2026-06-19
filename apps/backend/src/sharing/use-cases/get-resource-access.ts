import { Injectable } from "@nestjs/common";

import type { ResourceType } from "@repo/database";

import { AuthorizationService } from "../../authorization/authorization.service";

export interface ResourceAccess {
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canShare: boolean;
  /** Owning org + visibility, so the sharing UI can render the GitHub-style cards. */
  organizationId: string | null;
  visibility: "private" | "public" | null;
}

@Injectable()
export class GetResourceAccessUseCase {
  constructor(private readonly authz: AuthorizationService) {}

  async execute(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<ResourceAccess> {
    const [read, update, del, share, ownership] = await Promise.all([
      this.authz.can(userId, { resourceType, resourceId, action: "read" }),
      this.authz.can(userId, { resourceType, resourceId, action: "update" }),
      this.authz.can(userId, { resourceType, resourceId, action: "delete" }),
      this.authz.can(userId, { resourceType, resourceId, action: "share" }),
      this.authz.getOwnership(resourceType, resourceId),
    ]);
    return {
      canRead: read.allow,
      canUpdate: update.allow,
      canDelete: del.allow,
      canShare: share.allow,
      organizationId: ownership?.organizationId ?? null,
      visibility: ownership?.visibility ?? null,
    };
  }
}
