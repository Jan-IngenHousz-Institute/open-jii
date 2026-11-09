import { Inject, Injectable } from "@nestjs/common";

import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import { success } from "../../../common/utils/fp-utils";
import type { Result } from "../../../common/utils/fp-utils";
import { UserRepository } from "../../../users/core/repositories/user.repository";
import type {
  ExperimentQueryParams,
  ExperimentTableMetadata,
  ExperimentTableType,
} from "../../core/models/experiment-data.model";
import type {
  ExperimentTableReads,
  TableQuery,
} from "../../core/ports/experiment-table-reads.port";
import { SERVING_STORE_PORT } from "../../core/ports/serving-store.port";
import type { ServingStorePort, StoreQueryColumn } from "../../core/ports/serving-store.port";
import { ExperimentDeviceRegistryRepository } from "../../core/repositories/experiment-device-registry.repository";

type IdColumns = Map<string, "contributor" | "device">;

/** A contributor as the warehouse's views show one. */
interface ContributorCell {
  id: string;
  name: string;
  avatar: string | null;
}

/** A device as the warehouse's views show one, all null when the registry does not know it. */
interface DeviceCell {
  id: string | null;
  serial_number: string | null;
  owner: string | null;
  status: string | null;
  device_type: string | null;
}

const DEVICE_FIELDS: (keyof DeviceCell)[] = [
  "id",
  "serial_number",
  "owner",
  "status",
  "device_type",
];

/**
 * Reads through the serving store, which holds contributors and devices as their ids. Their
 * details are filled from Postgres for the rows a read returns, by the lookups the pipelines'
 * user and device webhooks make, so names are current and never enter a query the store logs.
 */
@Injectable()
export class ExperimentStoreReadsService implements ExperimentTableReads {
  // One statement reads any page.
  readonly picksLargePagesById = false;

  constructor(
    @Inject(SERVING_STORE_PORT) private readonly store: ServingStorePort,
    private readonly userRepository: UserRepository,
    private readonly deviceRepository: ExperimentDeviceRegistryRepository,
  ) {}

  readsTable(tableName: string): boolean {
    return this.store.holdsTable(tableName);
  }

  tablesMetadata(experimentId: string): Promise<Result<ExperimentTableMetadata[]>> {
    return this.store.getExperimentTableMetadata(experimentId);
  }

  viewColumns(tableType: ExperimentTableType, identifier: string): Promise<Result<string[]>> {
    const columns = this.store.getExperimentTableColumns(tableType, identifier);
    if (columns.isFailure()) {
      return Promise.resolve(columns);
    }
    return Promise.resolve(success(columns.value.map(({ name }) => name)));
  }

  async buildQuery(params: ExperimentQueryParams): Promise<Result<TableQuery>> {
    const columnsResult = this.store.getExperimentTableColumns(params.tableType, params.tableName);
    if (columnsResult.isFailure()) {
      return columnsResult;
    }
    const idColumns: IdColumns = new Map(
      columnsResult.value.flatMap(({ name, idOf }) => (idOf === undefined ? [] : [[name, idOf]])),
    );

    const [orderResult, serialsResult] = await Promise.all([
      this.idOrder(params, idColumns),
      this.serialNumbers(params, idColumns),
    ]);
    if (orderResult.isFailure()) {
      return orderResult;
    }
    if (serialsResult.isFailure()) {
      return serialsResult;
    }

    // Devices the registry does not know fill in alike, so a limit on their ids would stop short
    // of the distinct devices behind them.
    const isDistinctDevice =
      params.distinct === true &&
      (params.columns ?? []).some((column) => idColumns.get(column) === "device");
    const built = this.store.buildExperimentQuery({
      ...params,
      limit: isDistinctDevice ? undefined : params.limit,
      orderByIds: orderResult.value,
      deviceSerials: serialsResult.value,
    });
    if (built.isFailure()) {
      return built;
    }
    return success({
      ...built.value,
      distinct: params.distinct ?? false,
      limitAfterDetails: isDistinctDevice ? params.limit : undefined,
    });
  }

  countQuery(query: TableQuery): TableQuery {
    return { ...this.store.countQuery(query), distinct: false };
  }

  async runQuery(query: TableQuery): Promise<Result<SchemaData>> {
    const result = await this.store.executeQuery(query);
    if (result.isFailure()) {
      return result;
    }

    const filled = await this.fillDetails(result.value, query.columns);
    if (filled.isFailure() || !query.distinct) {
      return filled;
    }

    const distinct = this.withoutRepeats(filled.value);
    const rows = distinct.rows.slice(0, query.limitAfterDetails);
    return success({ ...distinct, rows, totalRows: rows.length });
  }

  /**
   * The ids a sort needs in order: contributors by name, as Spark compares text, or devices by
   * the whole struct, as Spark compares structs. A sort the store can do itself needs none.
   */
  private async idOrder(
    params: ExperimentQueryParams,
    idColumns: IdColumns,
  ): Promise<Result<string[] | undefined>> {
    if (params.ordering === undefined || params.ordering.mode !== undefined) {
      return success(undefined);
    }

    const [column, field] = this.structPath(params.ordering.column);
    const idOf = idColumns.get(column);
    const isContributorName = idOf === "contributor" && field === "name";
    const isWholeDevice = idOf === "device" && field === undefined;

    if (isContributorName) {
      const contributors = await this.contributorsOf(params.experimentId);
      if (contributors.isFailure()) {
        return contributors;
      }
      const byName = [...contributors.value.values()].sort(
        (a, b) => this.compareText(a.name, b.name) || this.compareText(a.id, b.id),
      );
      return success(byName.map(({ id }) => id));
    }
    if (isWholeDevice) {
      const devices = await this.devicesOf(params.experimentId);
      if (devices.isFailure()) {
        return devices;
      }
      const byStruct = [...devices.value.entries()].sort(
        ([aId, a], [bId, b]) => this.compareDevices(a, b) || this.compareText(aId, bId),
      );
      return success(byStruct.map(([clientId]) => clientId));
    }
    return success(undefined);
  }

  private async serialNumbers(
    params: ExperimentQueryParams,
    idColumns: IdColumns,
  ): Promise<Result<[string, string | null][] | undefined>> {
    const columns = [
      ...(params.filters ?? []).map(({ column }) => column),
      params.ordering?.column ?? "",
    ];
    const namesSerialNumber = columns.some((column) => {
      const [name, field] = this.structPath(column);
      return idColumns.get(name) === "device" && field === "serial_number";
    });
    if (!namesSerialNumber) {
      return success(undefined);
    }

    const devices = await this.devicesOf(params.experimentId);
    if (devices.isFailure()) {
      return devices;
    }
    return success(
      [...devices.value.entries()].map(([clientId, device]): [string, string | null] => [
        clientId,
        device.serial_number,
      ]),
    );
  }

  private async contributorsOf(
    experimentId: string,
  ): Promise<Result<Map<string, ContributorCell>>> {
    const ids = await this.store.getExperimentIds(experimentId, "contributor");
    return ids.isFailure() ? ids : this.contributors(ids.value);
  }

  private async devicesOf(experimentId: string): Promise<Result<Map<string, DeviceCell>>> {
    const ids = await this.store.getExperimentIds(experimentId, "device");
    return ids.isFailure() ? ids : this.devices(ids.value);
  }

  /** A contributor without a profile, or whose id is no user's, has an empty name. */
  private async contributors(userIds: string[]): Promise<Result<Map<string, ContributorCell>>> {
    const found = await this.userRepository.findUsersByIds(userIds);
    if (found.isFailure()) {
      return found;
    }

    const profiles = new Map(found.value.map((profile) => [profile.userId, profile]));
    const cells = userIds.map((id): [string, ContributorCell] => {
      const profile = profiles.get(id);
      // The pipelines join the names with a space and skip a missing one, as concat_ws does.
      const name = [profile?.firstName, profile?.lastName]
        .filter((part) => part !== undefined)
        .join(" ");
      return [id, { id, name, avatar: profile?.avatarUrl ?? null }];
    });
    return success(new Map(cells));
  }

  private async devices(clientIds: string[]): Promise<Result<Map<string, DeviceCell>>> {
    const found = await this.deviceRepository.findByThingNames(clientIds);
    if (found.isFailure()) {
      return found;
    }

    const devices = new Map(found.value.map((device) => [device.thingName, device]));
    const cells = clientIds.map((clientId): [string, DeviceCell] => {
      const device = devices.get(clientId);
      return [
        clientId,
        {
          id: device?.id ?? null,
          serial_number: device?.serialNumber ?? null,
          owner: device?.createdBy ?? null,
          status: device?.status ?? null,
          device_type: device?.deviceType ?? null,
        },
      ];
    });
    return success(new Map(cells));
  }

  private async fillDetails(
    data: SchemaData,
    columns: StoreQueryColumn[],
  ): Promise<Result<SchemaData>> {
    const indexesOf = (idOf: "contributor" | "device") =>
      columns.flatMap((column, index) => (column.idOf === idOf ? [index] : []));
    const contributorIndexes = indexesOf("contributor");
    const deviceIndexes = indexesOf("device");
    if (contributorIndexes.length === 0 && deviceIndexes.length === 0) {
      return success(data);
    }

    const idsAt = (indexes: number[]) => [
      ...new Set(data.rows.flatMap((row) => indexes.flatMap((index) => row[index] ?? []))),
    ];
    const [contributors, devices] = await Promise.all([
      this.contributors(idsAt(contributorIndexes)),
      this.devices(idsAt(deviceIndexes)),
    ]);
    if (contributors.isFailure()) {
      return contributors;
    }
    if (devices.isFailure()) {
      return devices;
    }

    const cellOf = (index: number, id: string | null): string | null => {
      if (id === null) {
        return null;
      }
      const detail = contributorIndexes.includes(index)
        ? contributors.value.get(id)
        : devices.value.get(id);
      return JSON.stringify(detail);
    };
    const rows = data.rows.map((row) =>
      row.map((cell, index) =>
        contributorIndexes.includes(index) || deviceIndexes.includes(index)
          ? cellOf(index, cell)
          : cell,
      ),
    );
    return success({ ...data, rows });
  }

  /** Two devices the registry does not know read alike, as one row does on the warehouse. */
  private withoutRepeats(data: SchemaData): SchemaData {
    const seen = new Set<string>();
    const rows = data.rows.filter((row) => {
      const key = JSON.stringify(row);
      const isRepeat = seen.has(key);
      seen.add(key);
      return !isRepeat;
    });
    return { ...data, rows, totalRows: rows.length };
  }

  /** Spark orders structs field by field, nulls first. */
  private compareDevices(a: DeviceCell, b: DeviceCell): number {
    for (const field of DEVICE_FIELDS) {
      const order = this.compareNullable(a[field], b[field]);
      if (order !== 0) {
        return order;
      }
    }
    return 0;
  }

  private compareNullable(a: string | null, b: string | null): number {
    if (a === null || b === null) {
      return a === b ? 0 : a === null ? -1 : 1;
    }
    return this.compareText(a, b);
  }

  /** Spark compares text by its UTF-8 bytes. */
  private compareText(a: string, b: string): number {
    return Buffer.compare(Buffer.from(a), Buffer.from(b));
  }

  private structPath(column: string): [string, string | undefined] {
    const dot = column.indexOf(".");
    return dot === -1 ? [column, undefined] : [column.slice(0, dot), column.slice(dot + 1)];
  }
}
