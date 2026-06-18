import { Inject, Injectable } from "@nestjs/common";

import {
  and,
  desc,
  eq,
  organizations,
  profiles,
  resourceGrants,
  teams,
  users,
} from "@repo/database";
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

/** Display info for a grant's grantee (person/org/team), for the sharing list UI. */
export interface GranteeInfo {
  type: GranteeType;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export interface ResourceGrantWithGranteeRow extends ResourceGrantRow {
  grantee: GranteeInfo;
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

  /**
   * Grants on a resource, each enriched with its grantee's display info via LEFT
   * JOINs to users/profiles (user grants), organizations (org grants), and teams
   * (team grants). A grantee id only matches its own table, so the joins never collide.
   */
  list(
    resourceType: ResourceType,
    resourceId: string,
  ): Promise<Result<ResourceGrantWithGranteeRow[]>> {
    return tryCatch(async () => {
      const rows = await this.db
        .select({
          ...this.fields,
          profileFirstName: profiles.firstName,
          profileLastName: profiles.lastName,
          profileAvatarUrl: profiles.avatarUrl,
          userName: users.name,
          userEmail: users.email,
          userImage: users.image,
          orgName: organizations.name,
          teamName: teams.name,
        })
        .from(resourceGrants)
        .leftJoin(
          users,
          and(eq(resourceGrants.granteeType, "user"), eq(users.id, resourceGrants.granteeId)),
        )
        .leftJoin(profiles, eq(profiles.userId, resourceGrants.granteeId))
        .leftJoin(
          organizations,
          and(
            eq(resourceGrants.granteeType, "organization"),
            eq(organizations.id, resourceGrants.granteeId),
          ),
        )
        .leftJoin(
          teams,
          and(eq(resourceGrants.granteeType, "team"), eq(teams.id, resourceGrants.granteeId)),
        )
        .where(
          and(
            eq(resourceGrants.resourceType, resourceType),
            eq(resourceGrants.resourceId, resourceId),
          ),
        )
        .orderBy(desc(resourceGrants.createdAt));

      return rows.map((r) => ({
        id: r.id,
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        granteeType: r.granteeType,
        granteeId: r.granteeId,
        role: r.role,
        createdAt: r.createdAt,
        createdBy: r.createdBy,
        grantee: buildGrantee(r),
      }));
    });
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

  updateRole(grantId: string, role: string): Promise<Result<ResourceGrantRow[]>> {
    return tryCatch(() =>
      this.db
        .update(resourceGrants)
        .set({ role })
        .where(eq(resourceGrants.id, grantId))
        .returning(this.fields),
    );
  }

  deleteById(grantId: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.db.delete(resourceGrants).where(eq(resourceGrants.id, grantId));
    });
  }

  /** Whether a grantee (user/org/team) exists. */
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
    const rows = await this.db
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.id, granteeId))
      .limit(1);
    return rows.length > 0;
  }
}

interface GranteeJoinRow {
  granteeType: GranteeType;
  profileFirstName: string | null;
  profileLastName: string | null;
  profileAvatarUrl: string | null;
  userName: string | null;
  userEmail: string | null;
  userImage: string | null;
  orgName: string | null;
  teamName: string | null;
}

/** Collapse the LEFT-JOINed grantee columns into one display object. */
function buildGrantee(r: GranteeJoinRow): GranteeInfo {
  if (r.granteeType === "user") {
    const profileName =
      r.profileFirstName && r.profileLastName ? `${r.profileFirstName} ${r.profileLastName}` : null;
    return {
      type: "user",
      displayName: profileName ?? r.userName,
      email: r.userEmail,
      avatarUrl: r.profileAvatarUrl ?? r.userImage,
    };
  }
  if (r.granteeType === "organization") {
    return { type: "organization", displayName: r.orgName, email: null, avatarUrl: null };
  }
  return { type: "team", displayName: r.teamName, email: null, avatarUrl: null };
}
