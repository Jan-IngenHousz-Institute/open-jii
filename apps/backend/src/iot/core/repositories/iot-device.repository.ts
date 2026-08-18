import { Injectable, Inject } from "@nestjs/common";

import {
  and,
  desc,
  deleteResourceGrants,
  eq,
  inArray,
  iotDevices,
  isNull,
  or,
  ensurePersonalOrganization,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { accessibleResourceCondition } from "../../../common/utils/resource-access-scope";
import { lockStaffedResource, seedCreatorControl } from "../../../sharing/core/resource-staffing";
import { CreateIotDeviceDto, IotDeviceDto, UpdateIotDeviceDto } from "../models/iot-device.model";

@Injectable()
export class IotDeviceRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  async create(
    createIotDeviceDto: CreateIotDeviceDto,
    userId: string,
    targetOrganizationId?: string | null,
  ): Promise<Result<IotDeviceDto[]>> {
    return tryCatch(async () => {
      // Own the device with the requested org, falling back to the creator's
      // personal org so there is never an org-less device.
      const organizationId =
        targetOrganizationId ?? (await ensurePersonalOrganization(this.database, { id: userId }));

      return this.database.transaction(async (tx) => {
        const results = await tx
          .insert(iotDevices)
          .values({ ...createIotDeviceDto, createdBy: userId, organizationId })
          .returning();

        // A plain org `member` may register a device but is read-only, so without a
        // grant they could not manage certificates on the device they just added.
        await seedCreatorControl(tx, "device", results[0].id, organizationId, userId);

        return results;
      });
    });
  }

  // `createdBy` is an extra tier on the shared predicate, so a creator later removed
  // from the owning org still sees devices they registered. The predicate's public
  // arm is unreachable — devices are permanently private.
  async listAccessible(userId: string): Promise<Result<IotDeviceDto[]>> {
    return tryCatch(async () => {
      const scope = accessibleResourceCondition({
        database: this.database,
        resourceType: "device",
        resourceIdColumn: iotDevices.id,
        organizationIdColumn: iotDevices.organizationId,
        visibilityColumn: iotDevices.visibility,
        userId,
      });
      const results = await this.database
        .select()
        .from(iotDevices)
        .where(or(eq(iotDevices.createdBy, userId), scope))
        .orderBy(desc(iotDevices.createdAt));
      return results;
    });
  }

  // Loads a device without owner-scoping. Authorization is enforced upstream by
  // the @CanAccess guard (org role / grant / public), so org-based access works.
  async findById(deviceId: string): Promise<Result<IotDeviceDto | null>> {
    return tryCatch(async () => {
      const results = await this.database
        .select()
        .from(iotDevices)
        .where(eq(iotDevices.id, deviceId))
        .limit(1);
      return results.length === 0 ? null : results[0];
    });
  }

  async findBySerialNumber(serialNumber: string): Promise<Result<IotDeviceDto | null>> {
    return tryCatch(async () => {
      const results = await this.database
        .select()
        .from(iotDevices)
        .where(eq(iotDevices.serialNumber, serialNumber))
        .limit(1);
      return results.length === 0 ? null : results[0];
    });
  }

  // Cross-owner lookup for the Databricks lineage webhook: the pipeline resolves
  // broker-authenticated thing names to registry rows, so this is not owner-scoped.
  async findByThingNames(thingNames: string[]): Promise<Result<IotDeviceDto[]>> {
    return tryCatch(async () => {
      if (thingNames.length === 0) {
        return [];
      }
      const results = await this.database
        .select()
        .from(iotDevices)
        .where(inArray(iotDevices.thingName, thingNames));
      return results;
    });
  }

  /**
   * Set the name only while it is still NULL, atomically: a concurrent rename
   * between read and write must win over a device-model fill.
   */
  async fillNameIfMissing(deviceId: string, name: string): Promise<Result<IotDeviceDto | null>> {
    return tryCatch(async () => {
      const results = await this.database
        .update(iotDevices)
        .set({ name })
        .where(and(eq(iotDevices.id, deviceId), isNull(iotDevices.name)))
        .returning();
      return results.length === 0 ? null : results[0];
    });
  }

  async update(deviceId: string, patch: UpdateIotDeviceDto): Promise<Result<IotDeviceDto | null>> {
    return tryCatch(async () => {
      const results = await this.database
        .update(iotDevices)
        .set(patch)
        .where(eq(iotDevices.id, deviceId))
        .returning();
      return results.length === 0 ? null : results[0];
    });
  }

  async delete(deviceId: string): Promise<Result<IotDeviceDto[]>> {
    return tryCatch(() =>
      // Grants are polymorphic (no FK cascade), so they need cleaning by hand. One
      // transaction, or a failure here strips access while the API reports failure.
      this.database.transaction(async (tx) => {
        await lockStaffedResource(tx, "device", deviceId, "update");

        await deleteResourceGrants(tx, "device", deviceId);

        return tx.delete(iotDevices).where(eq(iotDevices.id, deviceId)).returning();
      }),
    );
  }
}
