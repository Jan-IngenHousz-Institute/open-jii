import { Injectable } from "@nestjs/common";

import type { ResourceType } from "@repo/database";

import { AuthorizationService } from "../../authorization/authorization.service";

export interface ResourceAccess {
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canShare: boolean;
}

@Injectable()
export class GetResourceAccessUseCase {
  constructor(private readonly authz: AuthorizationService) {}

  async execute(
    userId: string,
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<ResourceAccess> {
    const [read, update, del, share] = await Promise.all([
      this.authz.can(userId, { resourceType, resourceId, action: "read" }),
      this.authz.can(userId, { resourceType, resourceId, action: "update" }),
      this.authz.can(userId, { resourceType, resourceId, action: "delete" }),
      this.authz.can(userId, { resourceType, resourceId, action: "share" }),
    ]);
    return {
      canRead: read.allow,
      canUpdate: update.allow,
      canDelete: del.allow,
      canShare: share.allow,
    };
  }
}
