import { Injectable, Inject } from "@nestjs/common";

import { and, eq, invitations, profiles, experiments, experimentMembers } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import type { InvitationDto } from "../models/user-invitation.model";

@Injectable()
export class InvitationRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async create(
    resourceType: "experiment",
    resourceId: string,
    email: string,
    role: string,
    invitedBy: string,
  ): Promise<Result<InvitationDto>> {
    return tryCatch(async () => {
      const result = await this.database
        .insert(invitations)
        .values({
          resourceType,
          resourceId,
          email: email.toLowerCase(),
          role,
          invitedBy,
        })
        .returning();

      return result[0] as InvitationDto;
    });
  }

  async findPendingByResourceAndEmail(
    resourceType: "experiment",
    resourceId: string,
    email: string,
  ): Promise<Result<InvitationDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.resourceType, resourceType),
            eq(invitations.resourceId, resourceId),
            eq(invitations.email, email.toLowerCase()),
            eq(invitations.status, "pending"),
          ),
        )
        .limit(1);

      return result.length > 0 ? (result[0] as InvitationDto) : null;
    });
  }

  async findById(id: string): Promise<Result<InvitationDto | null>> {
    return tryCatch(async () => {
      const result = await this.database
        .select()
        .from(invitations)
        .where(eq(invitations.id, id))
        .limit(1);

      return result.length > 0 ? (result[0] as InvitationDto) : null;
    });
  }

  async listByResource(
    resourceType: "experiment",
    resourceId: string,
  ): Promise<Result<InvitationDto[]>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({
          id: invitations.id,
          resourceType: invitations.resourceType,
          resourceId: invitations.resourceId,
          email: invitations.email,
          role: invitations.role,
          status: invitations.status,
          invitedBy: invitations.invitedBy,
          createdAt: invitations.createdAt,
          updatedAt: invitations.updatedAt,
          inviterFirstName: profiles.firstName,
          inviterLastName: profiles.lastName,
          resourceName: experiments.name,
        })
        .from(invitations)
        .leftJoin(profiles, eq(invitations.invitedBy, profiles.userId))
        .leftJoin(experiments, eq(invitations.resourceId, experiments.id))
        .where(
          and(
            eq(invitations.resourceType, resourceType),
            eq(invitations.resourceId, resourceId),
            eq(invitations.status, "pending"),
          ),
        );

      return rows.map((row) => ({
        id: row.id,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        email: row.email,
        role: row.role,
        status: row.status,
        invitedBy: row.invitedBy,
        invitedByName:
          row.inviterFirstName && row.inviterLastName
            ? `${row.inviterFirstName} ${row.inviterLastName}`
            : undefined,
        resourceName: row.resourceName ?? undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })) as InvitationDto[];
    });
  }

  async revoke(id: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .update(invitations)
        .set({ status: "revoked" })
        .where(eq(invitations.id, id));
    });
  }

  async updateRole(id: string, role: string): Promise<Result<InvitationDto>> {
    return tryCatch(async () => {
      const result = await this.database
        .update(invitations)
        .set({ role })
        .where(and(eq(invitations.id, id), eq(invitations.status, "pending")))
        .returning();

      return result[0] as InvitationDto;
    });
  }

  /**
   * Resolves the human-readable name of a resource.
   * Currently only supports experiment resources.
   */
  async findResourceName(_resourceType: "experiment", resourceId: string): Promise<Result<string>> {
    return tryCatch(async () => {
      const result = await this.database
        .select({ name: experiments.name })
        .from(experiments)
        .where(eq(experiments.id, resourceId))
        .limit(1);

      return result.length > 0 ? result[0].name : "an experiment";
    });
  }

  /**
   * Find all pending invitations for a given email address.
   * Used when a new user registers to automatically accept their invitations.
   */
  async findPendingByEmail(email: string): Promise<Result<InvitationDto[]>> {
    return tryCatch(async () => {
      const result = await this.database
        .select()
        .from(invitations)
        .where(and(eq(invitations.email, email.toLowerCase()), eq(invitations.status, "pending")));

      return result as InvitationDto[];
    });
  }

  /**
   * Accept an invitation and add the user as a member of the associated resource in a transaction.
   * Currently only supports experiment resources.
   */
  async acceptInvitation(
    invitationId: string,
    userId: string,
    _resourceType: "experiment",
    resourceId: string,
    role: string,
  ): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database.transaction(async (tx) => {
        // Mark invitation as accepted
        await tx
          .update(invitations)
          .set({ status: "accepted" })
          .where(eq(invitations.id, invitationId));

        // Add user as experiment member
        await tx
          .insert(experimentMembers)
          .values({
            experimentId: resourceId,
            userId,
            role: role as "admin" | "member",
          })
          .onConflictDoNothing();
      });
    });
  }
}
