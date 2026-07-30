import { Injectable, Inject } from "@nestjs/common";

import {
  desc,
  deleteResourceGrants,
  eq,
  inArray,
  iotDevices,
  or,
  ensurePersonalOrganization,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { accessibleResourceCondition } from "../../../common/utils/resource-access-scope";
import { seedCreatorControl } from "../../../sharing/resource-staffing";
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

        // Same access-neutral seeding the other shareable types get: nothing is
        // written when registering into an org whose role already confers full
        // control, and an `admin` grant is written when it does not — a plain
        // `member` may register a device into a shared org, and `member` is
        // read-only, so without this they could not rotate or revoke the
        // certificates of the device they just brought online.
        await seedCreatorControl(tx, "device", results[0].id, organizationId, userId);

        return results;
      });
    });
  }

  // Org-aware device listing: a device is visible when the caller
  // created it, is a member of its owning organization, holds a grant on it, or
  // it is public — mirroring the experiment `findAll` scoping. The `createdBy`
  // tier is explicit (not covered by the shared predicate) so a creator who is
  // later removed from a non-personal owning org still sees the devices they
  // registered. The grant tier is what makes a shared device show up in the
  // grantee's registry; the public tier stays unreachable, since devices are
  // permanently private and no path writes their visibility.
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
      // Grant cleanup and the device delete are one transaction: the grants table
      // is polymorphic (no FK cascade), so it must be cleaned by hand — and if the
      // device delete failed after a committed cleanup, the device would survive
      // with every grant on it already gone, silently stripping its collaborators'
      // access while the API reported failure.
      this.database.transaction(async (tx) => {
        await deleteResourceGrants(tx, "device", deviceId);

        return tx.delete(iotDevices).where(eq(iotDevices.id, deviceId)).returning();
      }),
    );
  }
}
