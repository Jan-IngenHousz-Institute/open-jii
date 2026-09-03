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

  /**
   * Devices the caller may read — every one of them, or one organization's.
   *
   * `accessibleResourceCondition` and nothing else, which is what makes the two callers
   * one method. Authorship was an extra arm here until it was cut: it dated from when
   * the registry shipped standalone and `created_by` was the access model, and left
   * devices as the only type where creating something granted a permanent read.
   *
   * The predicate's public arm is unreachable for devices — `zPublishableResourceType`
   * excludes them, so a non-member sees one only through a grant.
   */
  async listAccessible(
    userId: string,
    options?: { organizationId?: string },
  ): Promise<Result<IotDeviceDto[]>> {
    return tryCatch(async () => {
      const scope = accessibleResourceCondition({
        database: this.database,
        resourceType: "device",
        resourceIdColumn: iotDevices.id,
        organizationIdColumn: iotDevices.organizationId,
        visibilityColumn: iotDevices.visibility,
        userId,
      });
      // Mobile self-registration stores no organization (`ensure-mobile-device` passes
      // null), so the access predicate cannot reach a self-registered phone at all: no
      // organization to be a member of, private by default, and nobody grants themselves
      // their own device. Hence the creator arm — narrowed to devices that have no
      // organization, because `created_by` is deliberately not an access source here:
      // once a device belongs to an organization, leaving that organization ends the
      // creator's access to it like anyone else's.
      const visible = or(
        and(isNull(iotDevices.organizationId), eq(iotDevices.createdBy, userId)),
        scope,
      );
      const organizationId = options?.organizationId;
      return this.database
        .select()
        .from(iotDevices)
        .where(
          organizationId ? and(eq(iotDevices.organizationId, organizationId), visible) : visible,
        )
        .orderBy(desc(iotDevices.createdAt));
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
