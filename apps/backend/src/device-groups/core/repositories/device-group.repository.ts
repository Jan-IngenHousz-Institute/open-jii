import { Injectable, Inject } from "@nestjs/common";

import {
  and,
  deleteResourceGrants,
  desc,
  deviceGroupMembers,
  deviceGroups,
  ensurePersonalOrganization,
  eq,
  inArray,
  iotDevices,
  or,
  sql,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { accessibleResourceCondition } from "../../../common/utils/resource-access-scope";
import { lockStaffedResource, seedCreatorControl } from "../../../sharing/core/resource-staffing";
import {
  CreateDeviceGroupDto,
  DeviceGroupDto,
  DeviceGroupMemberDto,
  DeviceGroupWithCountDto,
  UpdateDeviceGroupDto,
} from "../models/device-group.model";

@Injectable()
export class DeviceGroupRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  private memberCount() {
    return sql<number>`(select count(*)::int from ${deviceGroupMembers} where ${deviceGroupMembers.groupId} = ${deviceGroups.id})`;
  }

  async create(
    dto: CreateDeviceGroupDto,
    userId: string,
    targetOrganizationId?: string | null,
  ): Promise<Result<DeviceGroupDto[]>> {
    return tryCatch(async () => {
      const organizationId =
        targetOrganizationId ?? (await ensurePersonalOrganization(this.database, { id: userId }));

      return this.database.transaction(async (tx) => {
        const results = await tx
          .insert(deviceGroups)
          .values({ ...dto, createdBy: userId, organizationId })
          .returning();

        await seedCreatorControl(tx, "device_group", results[0].id, organizationId, userId);

        return results;
      });
    });
  }

  // Same tiering as devices: creators keep seeing groups they made even after
  // leaving the owning org. The predicate's public arm is unreachable, groups
  // are permanently private.
  async listAccessible(userId: string): Promise<Result<DeviceGroupWithCountDto[]>> {
    return tryCatch(async () => {
      const scope = accessibleResourceCondition({
        database: this.database,
        resourceType: "device_group",
        resourceIdColumn: deviceGroups.id,
        organizationIdColumn: deviceGroups.organizationId,
        visibilityColumn: deviceGroups.visibility,
        userId,
      });
      return this.database
        .select({
          id: deviceGroups.id,
          name: deviceGroups.name,
          description: deviceGroups.description,
          organizationId: deviceGroups.organizationId,
          visibility: deviceGroups.visibility,
          createdBy: deviceGroups.createdBy,
          createdAt: deviceGroups.createdAt,
          updatedAt: deviceGroups.updatedAt,
          memberCount: this.memberCount(),
        })
        .from(deviceGroups)
        .where(or(eq(deviceGroups.createdBy, userId), scope))
        .orderBy(desc(deviceGroups.createdAt));
    });
  }

  // Authorization is enforced upstream by @CanAccess, not owner-scoped here.
  async findById(groupId: string): Promise<Result<DeviceGroupWithCountDto | null>> {
    return tryCatch(async () => {
      const results = await this.database
        .select({
          id: deviceGroups.id,
          name: deviceGroups.name,
          description: deviceGroups.description,
          organizationId: deviceGroups.organizationId,
          visibility: deviceGroups.visibility,
          createdBy: deviceGroups.createdBy,
          createdAt: deviceGroups.createdAt,
          updatedAt: deviceGroups.updatedAt,
          memberCount: this.memberCount(),
        })
        .from(deviceGroups)
        .where(eq(deviceGroups.id, groupId))
        .limit(1);
      return results.length === 0 ? null : results[0];
    });
  }

  async update(
    groupId: string,
    patch: UpdateDeviceGroupDto,
  ): Promise<Result<DeviceGroupDto | null>> {
    return tryCatch(async () => {
      const results = await this.database
        .update(deviceGroups)
        .set(patch)
        .where(eq(deviceGroups.id, groupId))
        .returning();
      return results.length === 0 ? null : results[0];
    });
  }

  async delete(groupId: string): Promise<Result<DeviceGroupDto[]>> {
    return tryCatch(() =>
      // Grants are polymorphic (no FK cascade), so they need cleaning by hand,
      // in one transaction with the row.
      this.database.transaction(async (tx) => {
        await lockStaffedResource(tx, "device_group", groupId, "update");

        await deleteResourceGrants(tx, "device_group", groupId);

        return tx.delete(deviceGroups).where(eq(deviceGroups.id, groupId)).returning();
      }),
    );
  }

  async listMembers(groupId: string): Promise<Result<DeviceGroupMemberDto[]>> {
    return tryCatch(async () => {
      return this.database
        .select({
          deviceId: iotDevices.id,
          name: iotDevices.name,
          serialNumber: iotDevices.serialNumber,
          deviceType: iotDevices.deviceType,
          status: iotDevices.status,
          addedAt: deviceGroupMembers.createdAt,
        })
        .from(deviceGroupMembers)
        .innerJoin(iotDevices, eq(deviceGroupMembers.deviceId, iotDevices.id))
        .where(eq(deviceGroupMembers.groupId, groupId))
        .orderBy(desc(deviceGroupMembers.createdAt));
    });
  }

  async addMembers(groupId: string, deviceIds: string[], userId: string): Promise<Result<void>> {
    return tryCatch(async () => {
      // Re-adding an existing member is a no-op, not an error: the batch add
      // is used over heterogeneous selections.
      await this.database
        .insert(deviceGroupMembers)
        .values(deviceIds.map((deviceId) => ({ groupId, deviceId, addedBy: userId })))
        .onConflictDoNothing();
    });
  }

  async removeMember(groupId: string, deviceId: string): Promise<Result<void>> {
    return tryCatch(async () => {
      await this.database
        .delete(deviceGroupMembers)
        .where(
          and(eq(deviceGroupMembers.groupId, groupId), eq(deviceGroupMembers.deviceId, deviceId)),
        );
    });
  }

  /** Which of the given devices exist, for per-device membership guards. */
  async existingDeviceIds(deviceIds: string[]): Promise<Result<string[]>> {
    return tryCatch(async () => {
      const rows = await this.database
        .select({ id: iotDevices.id })
        .from(iotDevices)
        .where(inArray(iotDevices.id, deviceIds));
      return rows.map((row) => row.id);
    });
  }
}
