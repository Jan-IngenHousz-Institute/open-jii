import { Inject, Injectable } from "@nestjs/common";

import { and, desc, eq, organizations, resourceGrants, users } from "@repo/database";
import type { DatabaseInstance, GranteeType, ResourceType } from "@repo/database";

import { Result, tryCatch } from "../common/utils/fp-utils";

export interface ResourceGrantRow {
  id: string;
  resourceType: ResourceType;
  resourceId: string;
  granteeType: GranteeType;
  granteeId: string;
  role: string;
  createdAt: Date;
  createdBy: string | null;
}

export interface CreateGrantInput {
  resourceType: ResourceType;
  resourceId: string;
  granteeType: GranteeType;
  granteeId: string;
  role: string;
  createdBy: string;
}

@Injectable()
export class SharingRepository {
  constructor(@Inject("DATABASE") private readonly db: DatabaseInstance) {}

  private readonly fields = {
    id: resourceGrants.id,
    resourceType: resourceGrants.resourceType,
    resourceId: resourceGrants.resourceId,
    granteeType: resourceGrants.granteeType,
    granteeId: resourceGrants.granteeId,
    role: resourceGrants.role,
    createdAt: resourceGrants.createdAt,
    createdBy: resourceGrants.createdBy,
  };

  list(resourceType: ResourceType, resourceId: string): Promise<Result<ResourceGrantRow[]>> {
    return tryCatch(() =>
      this.db
        .select(this.fields)
        .from(resourceGrants)
        .where(
          and(
            eq(resourceGrants.resourceType, resourceType),
            eq(resourceGrants.resourceId, resourceId),
          ),
        )
        .orderBy(desc(resourceGrants.createdAt)),
    );
  }

  create(input: CreateGrantInput): Promise<Result<ResourceGrantRow[]>> {
    return tryCatch(() => this.db.insert(resourceGrants).values(input).returning(this.fields));
  }

  findById(
    resourceType: ResourceType,
    resourceId: string,
    grantId: string,
  ): Promise<Result<ResourceGrantRow[]>> {
    return tryCatch(() =>
      this.db
        .select(this.fields)
        .from(resourceGrants)
        .where(
          and(
            eq(resourceGrants.id, grantId),
            eq(resourceGrants.resourceType, resourceType),
            eq(resourceGrants.resourceId, resourceId),
          ),
        )
        .limit(1),
    );
  }

  deleteById(grantId: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.db.delete(resourceGrants).where(eq(resourceGrants.id, grantId));
    });
  }

  /** Whether a grantee (user/org) exists. Teams are not yet enabled. */
  async granteeExists(granteeType: GranteeType, granteeId: string): Promise<boolean> {
    if (granteeType === "user") {
      const rows = await this.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, granteeId))
        .limit(1);
      return rows.length > 0;
    }
    if (granteeType === "organization") {
      const rows = await this.db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.id, granteeId))
        .limit(1);
      return rows.length > 0;
    }
    return false;
  }
}
