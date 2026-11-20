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
  getTableColumns,
  isNull,
  ilike,
  or,
  sql,
  ensurePersonalOrganization,
  experimentDevices,
} from "@repo/database";
import type { DatabaseInstance, DbOrTx, Transaction } from "@repo/database";

import { Result, tryCatch } from "../../../common/utils/fp-utils";
import { escapeLike, ftsMatch, searchScore, tsQuery } from "../../../common/utils/fts";
import {
  accessibleResourceCondition,
  resourceTierExpression,
} from "../../../common/utils/resource-access-scope";
import { lockStaffedResource, seedCreatorControl } from "../../../sharing/core/resource-staffing";
import { CreateIotDeviceDto, IotDeviceDto, UpdateIotDeviceDto } from "../models/iot-device.model";

const { searchVector: _searchVector, ...deviceColumns } = getTableColumns(iotDevices);

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
        .select(deviceColumns)
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
          .select(deviceColumns)
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

  /** Runs `work` as one transaction, so a write and the copy it owes land together or not at all. */
  async transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<Result<T>> {
    return tryCatch(() => this.database.transaction(work));
  }

  async create(
    tx: DbOrTx,
    createIotDeviceDto: CreateIotDeviceDto,
    userId: string,
    targetOrganizationId?: string | null,
  ): Promise<IotDeviceDto> {
    // Own the device with the requested org, falling back to the creator's
    // personal org so there is never an org-less device.
    const organizationId =
      targetOrganizationId ?? (await ensurePersonalOrganization(tx, { id: userId }));

    const [device] = await tx
      .insert(iotDevices)
      .values({ ...createIotDeviceDto, createdBy: userId, organizationId })
      .returning(deviceColumns);

    // A plain org `member` may register a device but is read-only, so without a
    // grant they could not manage certificates on the device they just added.
    await seedCreatorControl(tx, "device", device.id, organizationId, userId);

    return device;
  }

  /**
   * Devices the caller may read, across organizations or within one organization.
   *
   * Organization membership and grants determine access to organization-owned devices.
   * Legacy rows without an organization remain accessible to their creator.
   *
   * The predicate's public arm is unreachable for devices. `zPublishableResourceType`
   * excludes them, so a non-member sees an organization-owned device only through a grant.
   */
  async listAccessible(
    userId: string,
    options?: { organizationId?: string },
  ): Promise<Result<IotDeviceDto[]>> {
    return tryCatch(async () => {
      const visible = this.visibleCondition(userId);
      const organizationId = options?.organizationId;
      return this.database
        .select(deviceColumns)
        .from(iotDevices)
        .where(
          organizationId ? and(eq(iotDevices.organizationId, organizationId), visible) : visible,
        )
        .orderBy(desc(iotDevices.createdAt));
    });
  }

  async search(
    query: string,
    userId: string,
    limit: number,
  ): Promise<
    Result<
      {
        id: string;
        name: string;
        description: string | null;
        deviceType: IotDeviceDto["deviceType"];
        score: number;
      }[]
    >
  > {
    return tryCatch(async () => {
      const name = sql<string>`coalesce(${iotDevices.name}, ${iotDevices.serialNumber})`;
      const rank = sql<number>`(ts_rank(${iotDevices.searchVector}, ${tsQuery(query)}) + 0.3 * GREATEST(similarity(${name}, ${query}), similarity(${iotDevices.serialNumber}, ${query})))`;
      const score = searchScore(
        rank,
        resourceTierExpression({
          database: this.database,
          resourceType: "device",
          resourceIdColumn: iotDevices.id,
          organizationIdColumn: iotDevices.organizationId,
          createdByColumn: iotDevices.createdBy,
          userId,
        }),
      );
      const rows = await this.database
        .select({
          id: iotDevices.id,
          name: iotDevices.name,
          serialNumber: iotDevices.serialNumber,
          deviceType: iotDevices.deviceType,
          score,
        })
        .from(iotDevices)
        .where(
          and(
            this.visibleCondition(userId),
            or(
              ftsMatch(iotDevices.searchVector, name, query),
              ilike(iotDevices.serialNumber, `%${escapeLike(query)}%`),
            ),
          ),
        )
        .orderBy(desc(score), iotDevices.id)
        .limit(limit);

      return rows.map(({ serialNumber, name, score, ...row }) => ({
        ...row,
        name: name ?? serialNumber,
        description: name !== null ? serialNumber : null,
        score: Number(score),
      }));
    });
  }

  private visibleCondition(userId: string) {
    const scope = accessibleResourceCondition({
      database: this.database,
      resourceType: "device",
      resourceIdColumn: iotDevices.id,
      organizationIdColumn: iotDevices.organizationId,
      visibilityColumn: iotDevices.visibility,
      userId,
    });
    // Legacy devices may have no owning organization, so their creators retain access
    // through this fallback. New mobile self-registrations belong to the creator's
    // personal organization. Once a device has an organization, access follows its
    // membership and grants rather than authorship.
    return or(and(isNull(iotDevices.organizationId), eq(iotDevices.createdBy, userId)), scope);
  }

  // Loads a device without owner-scoping. Authorization is enforced upstream by
  // the @CanAccess guard (org role / grant / public), so org-based access works.
  async findById(deviceId: string): Promise<Result<IotDeviceDto | null>> {
    return tryCatch(async () => {
      const results = await this.database
        .select(deviceColumns)
        .from(iotDevices)
        .where(eq(iotDevices.id, deviceId))
        .limit(1);
      return results.length === 0 ? null : results[0];
    });
  }

  async findBySerialNumber(serialNumber: string): Promise<Result<IotDeviceDto | null>> {
    return tryCatch(async () => {
      const results = await this.database
        .select(deviceColumns)
        .from(iotDevices)
        .where(eq(iotDevices.serialNumber, serialNumber))
        .limit(1);
      return results.length === 0 ? null : results[0];
    });
  }

  // Not owner-scoped: an experiment's publishers resolve to their registry rows
  // by the thing names they authenticated as, whoever owns the devices.
  async findByThingNames(thingNames: string[]): Promise<Result<IotDeviceDto[]>> {
    return tryCatch(async () => {
      if (thingNames.length === 0) {
        return [];
      }
      const results = await this.database
        .select(deviceColumns)
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
        .returning(deviceColumns);
      return results.length === 0 ? null : results[0];
    });
  }

  async update(
    tx: DbOrTx,
    deviceId: string,
    patch: UpdateIotDeviceDto,
  ): Promise<IotDeviceDto | null> {
    const results = await tx
      .update(iotDevices)
      .set(patch)
      .where(eq(iotDevices.id, deviceId))
      .returning(deviceColumns);
    return results.length === 0 ? null : results[0];
  }

  /**
   * Grants are polymorphic (no FK cascade), so they need cleaning by hand. Run it inside
   * `transaction`, or a failure here strips access while the API reports failure.
   */
  async delete(tx: DbOrTx, deviceId: string): Promise<IotDeviceDto[]> {
    await lockStaffedResource(tx, "device", deviceId, "update");

    await deleteResourceGrants(tx, "device", deviceId);

    return tx.delete(iotDevices).where(eq(iotDevices.id, deviceId)).returning(deviceColumns);
  }
}
