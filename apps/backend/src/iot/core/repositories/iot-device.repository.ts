import { Injectable, Inject } from "@nestjs/common";

import type { IotDeviceFilterQuery, IotDeviceRung } from "@repo/api/domains/iot/iot.schema";
import {
  and,
  asc,
  desc,
  deleteResourceGrants,
  eq,
  inArray,
  iotDevices,
  isNull,
  or,
  ensurePersonalOrganization,
  experimentDevices,
  ilike,
  sql,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { escapeLike } from "../../../common/utils/fts";
import { accessibleResourceCondition } from "../../../common/utils/resource-access-scope";
import { lockStaffedResource, seedCreatorControl } from "../../../sharing/core/resource-staffing";
import { CreateIotDeviceDto, IotDeviceDto, UpdateIotDeviceDto } from "../models/iot-device.model";

type DeviceListingParams = Omit<IotDeviceFilterQuery, "page" | "pageSize"> & { userId: string };

export function deviceRungSql() {
  const status = sql`${iotDevices}.${sql.identifier(iotDevices.status.name)}`;
  const deviceId = sql`${iotDevices}.${sql.identifier(iotDevices.id.name)}`;
  const boundDeviceId = sql`${experimentDevices}.${sql.identifier(experimentDevices.deviceId.name)}`;
  return sql<IotDeviceRung>`case when ${status} = 'active' then
    (case when exists (select 1 from ${experimentDevices}
      where ${boundDeviceId} = ${deviceId})
      then 'onboarded' else 'provisioned' end)
    else ${status}::text end`;
}

@Injectable()
export class IotDeviceRepository {
  constructor(
    @Inject("DATABASE")
    private readonly database: DatabaseInstance,
  ) {}

  private visibleCondition(userId: string) {
    const scope = accessibleResourceCondition({
      database: this.database,
      resourceType: "device",
      resourceIdColumn: iotDevices.id,
      organizationIdColumn: iotDevices.organizationId,
      visibilityColumn: iotDevices.visibility,
      userId,
    });
    return or(and(isNull(iotDevices.organizationId), eq(iotDevices.createdBy, userId)), scope);
  }

  private buildListing({ userId, search, status, family, sort }: DeviceListingParams) {
    const term = search?.trim();
    const like = term ? `%${escapeLike(term)}%` : undefined;
    const where = and(
      this.visibleCondition(userId),
      like ? or(ilike(iotDevices.name, like), ilike(iotDevices.serialNumber, like)) : undefined,
      family?.length ? inArray(iotDevices.deviceType, family) : undefined,
      status?.length ? inArray(deviceRungSql(), status) : undefined,
    );
    const rung = deviceRungSql();
    const fields = {
      name: sql`coalesce(${iotDevices.name}, ${iotDevices.serialNumber})`,
      status: sql`case ${rung} when 'registered' then 0 when 'provisioned' then 1
        when 'onboarded' then 2 when 'revoked' then 3 when 'retired' then 4 end`,
      family: sql`${iotDevices.deviceType}::text`,
      registered: iotDevices.createdAt,
    };
    const orderBy = [
      ...(sort?.length
        ? sort.map(
            ({ field, direction }) =>
              sql`${direction === "asc" ? asc(fields[field]) : desc(fields[field])} nulls last`,
          )
        : [sql`${desc(iotDevices.createdAt)} nulls last`]),
      asc(iotDevices.id),
    ];
    return { where, orderBy };
  }

  async findAll(params: DeviceListingParams): Promise<Result<IotDeviceDto[]>> {
    return tryCatch(async () => {
      const { where, orderBy } = this.buildListing(params);
      return this.database
        .select()
        .from(iotDevices)
        .where(where)
        .orderBy(...orderBy);
    });
  }

  async findPage(params: DeviceListingParams, page: number, pageSize: number) {
    return tryCatch(async () => {
      const { where, orderBy } = this.buildListing(params);
      const countsWhere = this.buildListing({ ...params, status: undefined }).where;
      const rung = deviceRungSql();
      const [items, counts] = await Promise.all([
        this.database
          .select()
          .from(iotDevices)
          .where(where)
          .orderBy(...orderBy)
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        this.database
          .select({ rung, count: sql<number>`count(*)::int` })
          .from(iotDevices)
          .where(countsWhere)
          .groupBy(sql`1`),
      ]);
      const statusCounts: Record<IotDeviceRung, number> = {
        registered: 0,
        provisioned: 0,
        onboarded: 0,
        revoked: 0,
        retired: 0,
      };
      for (const { rung, count } of counts) statusCounts[rung] = count;
      const totalCount = counts.reduce(
        (total, { rung, count }) =>
          total + (!params.status?.length || params.status.includes(rung) ? count : 0),
        0,
      );
      return { items, totalCount, statusCounts };
    });
  }

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
      // Mobile self-registration stores no organization (`ensure-mobile-device` passes
      // null), so the access predicate cannot reach a self-registered phone at all: no
      // organization to be a member of, private by default, and nobody grants themselves
      // their own device. Hence the creator arm — narrowed to devices that have no
      // organization, because `created_by` is deliberately not an access source here:
      // once a device belongs to an organization, leaving that organization ends the
      // creator's access to it like anyone else's.
      const visible = this.visibleCondition(userId);
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
