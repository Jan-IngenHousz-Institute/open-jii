import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod";

import type { ExperimentDataFlagged } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { FlattenedFields } from "../../../common/modules/databricks/services/query-builder/schema/flattened-fields";
import type { SchemaData } from "../../../common/modules/databricks/services/sql/sql.types";
import { success } from "../../../common/utils/fp-utils";
import type { Result } from "../../../common/utils/fp-utils";
import { UserRepository } from "../../../users/core/repositories/user.repository";
import type {
  ExperimentQueryParams,
  ExperimentTableMetadata,
  ExperimentTableType,
  FlaggedRows,
} from "../../core/models/experiment-data.model";
import { PageBytes } from "../../core/models/page-bytes.model";
import type {
  ExperimentTableReads,
  TableQuery,
} from "../../core/ports/experiment-table-reads.port";
import { SERVING_STORE_PORT } from "../../core/ports/serving-store.port";
import type { ServingStorePort, StoreQueryColumn } from "../../core/ports/serving-store.port";
import { ExperimentAnnotationsRepository } from "../../core/repositories/experiment-annotations.repository";
import { ExperimentDeviceRegistryRepository } from "../../core/repositories/experiment-device-registry.repository";
import { CustomMetadataService } from "./custom-metadata.service";
import { NumberAnswersService } from "./number-answers.service";

type IdColumns = Map<string, "contributor" | "device">;

/** A contributor as the warehouse's views show one. */
interface ContributorCell {
  id: string;
  name: string;
  avatar: string | null;
}

/** A device as the registry knows it, all null when the registry does not know it. */
interface DeviceCell {
  id: string | null;
  serial_number: string | null;
  owner: string | null;
  status: string | null;
  device_type: string | null;
}

const UNKNOWN_DEVICE: DeviceCell = {
  id: null,
  serial_number: null,
  owner: null,
  status: null,
  device_type: null,
};

const zDevicePair = z.tuple([z.string().nullable(), z.string().nullable()]);

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
    private readonly numberAnswers: NumberAnswersService,
    private readonly annotationsRepository: ExperimentAnnotationsRepository,
    private readonly customMetadata: CustomMetadataService,
  ) {}

  readsTable(tableName: string): boolean {
    return this.store.holdsTable(tableName);
  }

  async tablesMetadata(experimentId: string): Promise<Result<ExperimentTableMetadata[]>> {
    const metadata = await this.store.getExperimentTableMetadata(experimentId);
    if (metadata.isFailure()) {
      return metadata;
    }
    const withCustomMetadata = await this.customMetadata.typed(experimentId, metadata.value);
    if (withCustomMetadata.isFailure()) {
      return withCustomMetadata;
    }
    return this.numberAnswers.typed(experimentId, withCustomMetadata.value);
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

    const devicesResult = this.readsLabels(params, idColumns)
      ? await this.devicesOf(params.experimentId)
      : success(undefined);
    if (devicesResult.isFailure()) {
      return devicesResult;
    }
    const devices = devicesResult.value;

    const sortsByRegistry = devices !== undefined && this.sortsWholeDevice(params, idColumns);
    const orderResult = sortsByRegistry
      ? success(this.registryOrder(devices))
      : await this.contributorOrder(params, idColumns);
    if (orderResult.isFailure()) {
      return orderResult;
    }

    const sheetsResult = this.readsSheets(params)
      ? await this.customMetadata.sheets(params.experimentId)
      : success([]);
    if (sheetsResult.isFailure()) {
      return sheetsResult;
    }

    // Devices can fill in alike, such as a registered one under two names, so a limit on what the
    // store returns would stop short of the distinct devices behind it.
    const isDistinctDevice =
      params.distinct === true &&
      (params.columns ?? []).some((column) => idColumns.get(column) === "device");
    const built = this.store.buildExperimentQuery({
      ...params,
      limit: isDistinctDevice ? undefined : params.limit,
      orderByIds: orderResult.value,
      deviceSerials: devices === undefined ? undefined : this.serialsShown(devices),
      metadataSheets: sheetsResult.value,
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

  /**
   * The rows a read filtered by `kind` keeps, the ones flagged since they were measured taken from
   * Postgres. A read looks them up once, so its page and its count keep the same rows.
   */
  async flaggedRows(
    experimentId: string,
    tableName: string,
    kind: ExperimentDataFlagged,
  ): Promise<Result<FlaggedRows>> {
    const added = await this.annotationsRepository.findFlaggedRowIds(experimentId, tableName);
    return added.isFailure() ? added : success({ kind, addedRowIds: added.value });
  }

  deviceLabelsQuery(query: TableQuery, limit: number, offset: number): TableQuery {
    return { ...this.store.deviceLabelsQuery(query, limit, offset), distinct: false };
  }

  /**
   * The rows in the warehouse's cells, marked truncated, as the warehouse marks a result it cuts,
   * when those cells pass the limit one read may return, so the same pages are refused.
   */
  async runQuery(query: TableQuery): Promise<Result<SchemaData>> {
    const result = await this.store.executeQuery(query);
    if (result.isFailure()) {
      return result;
    }

    const filled = await this.fillDetails(result.value, query.columns);
    if (filled.isFailure()) {
      return filled;
    }

    const data = query.distinct
      ? this.withoutRepeats(filled.value, query.limitAfterDetails)
      : filled.value;
    const rows = PageBytes.fitting(data.rows);
    const isTruncated = data.truncated || rows.length < data.rows.length;
    return success({ ...data, rows, totalRows: rows.length, truncated: isTruncated });
  }

  /**
   * The contributors in the order of their names, as Spark compares text, for a sort by name the
   * store cannot do itself; names never enter a query.
   */
  private async contributorOrder(
    params: ExperimentQueryParams,
    idColumns: IdColumns,
  ): Promise<Result<string[] | undefined>> {
    if (params.ordering === undefined || params.ordering.mode !== undefined) {
      return success(undefined);
    }
    const [column, field] = this.structPath(params.ordering.column);
    const isContributorName = idColumns.get(column) === "contributor" && field === "name";
    if (!isContributorName) {
      return success(undefined);
    }

    const contributors = await this.contributorsOf(params.experimentId);
    if (contributors.isFailure()) {
      return contributors;
    }
    const byName = [...contributors.value.values()].sort(
      (a, b) => this.compareText(a.name, b.name) || this.compareText(a.id, b.id),
    );
    return success(byName.map(({ id }) => id));
  }

  /**
   * Registered devices by their registry id, the first field of the struct Spark compares; the
   * store breaks the rest by label.
   */
  private registryOrder(devices: Map<string, DeviceCell>): string[] {
    const registered = [...devices.entries()].flatMap(([clientId, { id }]) =>
      id === null ? [] : [{ clientId, id }],
    );
    registered.sort((a, b) => this.compareText(a.id, b.id));
    return registered.map(({ clientId }) => clientId);
  }

  /** Whether the read filters, sorts or lists by a device's label, which needs its serial. */
  private readsLabels(params: ExperimentQueryParams, idColumns: IdColumns): boolean {
    const columns = [
      ...(params.filters ?? []).map(({ column }) => column),
      ...(params.columns ?? []),
      params.ordering?.column ?? "",
    ];
    const namesLabel = columns.some((column) => {
      const [name, field] = this.structPath(column);
      return idColumns.get(name) === "device" && field === "serial_number";
    });
    return namesLabel || this.sortsWholeDevice(params, idColumns);
  }

  /**
   * Whether the read shows, filters or sorts by a custom metadata field, the only reads that join
   * the sheets. A sheet's fields reach a read only through the custom metadata schema the listing
   * gave it, and a read that names no columns shows them all.
   */
  private readsSheets(params: ExperimentQueryParams): boolean {
    if (!this.store.takesCustomMetadata(params.tableType, params.tableName)) {
      return false;
    }
    const sources = (params.variants ?? []).map(({ columnName, schema, suffix }) => ({
      column: columnName,
      schema,
      suffix: suffix ?? columnName,
    }));
    const fields = new Set(
      FlattenedFields.resolve(params.reservedColumns ?? [], sources)
        .filter(({ column }) => column === "custom_metadata")
        .map(({ key }) => key),
    );
    const isEveryColumnShown = (params.columns ?? []).length === 0;
    const named = [
      ...(params.filters ?? []).map(({ column }) => column),
      ...(params.columns ?? []),
      params.ordering?.column ?? "",
    ];
    return (isEveryColumnShown && fields.size > 0) || named.some((name) => fields.has(name));
  }

  /** Only a serial a label shows enters the query; any other device reads none from the list. */
  private serialsShown(devices: Map<string, DeviceCell>): [string, string][] {
    return [...devices.entries()].flatMap(([clientId, { serial_number }]) =>
      this.showsSerial(serial_number) ? [[clientId, serial_number]] : [],
    );
  }

  /** The label's own rule, which Spark trims by spaces only: a serial of spaces shows the label. */
  private showsSerial(serial: string | null): serial is string {
    return serial !== null && /[^ ]/.test(serial);
  }

  private sortsWholeDevice({ ordering }: ExperimentQueryParams, idColumns: IdColumns): boolean {
    if (ordering === undefined || ordering.mode !== undefined) {
      return false;
    }
    const [column, field] = this.structPath(ordering.column);
    return idColumns.get(column) === "device" && field === undefined;
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
    const idOfColumn = new Map(columns.map(({ name, idOf }) => [name, idOf]));
    const indexesOf = (idOf: "contributor" | "device") =>
      data.columns.flatMap(({ name }, index) => (idOfColumn.get(name) === idOf ? [index] : []));
    const contributorIndexes = indexesOf("contributor");
    const deviceIndexes = indexesOf("device");
    if (contributorIndexes.length === 0 && deviceIndexes.length === 0) {
      return success(data);
    }

    const pairs = data.rows.map((row) =>
      deviceIndexes.map((index) => zDevicePair.parse(JSON.parse(String(row[index])))),
    );
    const contributorIds = new Set(
      data.rows.flatMap((row) => contributorIndexes.flatMap((index) => row[index] ?? [])),
    );
    const clientIds = new Set(pairs.flat().flatMap(([clientId]) => clientId ?? []));
    const [contributors, devices] = await Promise.all([
      this.contributors([...contributorIds]),
      this.devices([...clientIds]),
    ]);
    if (contributors.isFailure()) {
      return contributors;
    }
    if (devices.isFailure()) {
      return devices;
    }

    const contributorCell = (id: string | null) =>
      id === null ? null : JSON.stringify(contributors.value.get(id));
    const deviceCell = ([clientId, label]: [string | null, string | null]) => {
      const known = clientId === null ? undefined : devices.value.get(clientId);
      const registered = known ?? UNKNOWN_DEVICE;
      const serial = registered.serial_number;
      return JSON.stringify({
        ...registered,
        serial_number: this.showsSerial(serial) ? serial : label,
      });
    };
    const rows = data.rows.map((row, rowIndex) =>
      row.map((cell, index) => {
        if (contributorIndexes.includes(index)) {
          return contributorCell(cell);
        }
        const deviceAt = deviceIndexes.indexOf(index);
        return deviceAt === -1 ? cell : deviceCell(pairs[rowIndex][deviceAt]);
      }),
    );
    return success({ ...data, rows });
  }

  /** Rows that fill in alike read as one, as the warehouse's DISTINCT reads them. */
  private withoutRepeats(data: SchemaData, limit?: number): SchemaData {
    const seen = new Set<string>();
    const distinct = data.rows.filter((row) => {
      const key = JSON.stringify(row);
      const isRepeat = seen.has(key);
      seen.add(key);
      return !isRepeat;
    });
    const rows = distinct.slice(0, limit);
    return { ...data, rows, totalRows: rows.length };
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
