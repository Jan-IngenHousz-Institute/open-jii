import {
  aggregateKind,
  DATA_QUERY_MAX_LIMIT,
  DISTINCT_VALUES_DEFAULT_LIMIT,
  zExperimentDataQuery,
  zExperimentDistinctValuesQuery,
  zExperimentTableColumnsQuery,
} from "@repo/api/domains/experiment/data/experiment-data.schema";
import type {
  ExperimentAggregationItem,
  ExperimentDataAggregation,
  ExperimentDataColumn,
  ExperimentDataQuery,
  ExperimentDataResponse,
  ExperimentDataTable,
  ExperimentDistinctValuesResponse,
  ExperimentGroupByItem,
  ExperimentTableColumnsResponse,
  ExperimentTableMetadata,
  ExperimentTablesMetadataList,
  ExperimentTimeBucketUnit,
} from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentDataJoin } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { isNumericType } from "@repo/api/transforms/column-type-utils";
import { joinedColumns } from "@repo/api/transforms/joined-columns";
import {
  hasRelativeTimeFilters,
  relativeTimeMinute,
  resolveRelativeTimeFilters,
} from "@repo/api/transforms/relative-time-filter";

import type { FixtureRow, FixtureTable, FixtureValue } from "./fixture-tables.js";

export type DataRouteAnswer =
  | {
      status: 200;
      body:
        | ExperimentTablesMetadataList
        | ExperimentDataResponse
        | ExperimentDistinctValuesResponse
        | ExperimentTableColumnsResponse;
    }
  | { status: 400 | 404; body: { message: string } };

interface Shaped {
  columns: ExperimentDataColumn[];
  rows: FixtureRow[];
}

interface GroupKey {
  alias: string;
  type: string;
  valueOf: (row: FixtureRow) => FixtureValue;
}

type Scalar = string | number | boolean;

// A plain read with no page size returns this many rows, as the repository does.
const PLAIN_PAGE_SIZE = 5;

/**
 * Answers an experiment's four data routes from fixture tables, with the filter, bucket, aggregate
 * and paging semantics of the backend's query builder, so a chart draws what it would draw on
 * warehouse data. Input is parsed with the contract's own schemas.
 */
export class FixtureQuery {
  constructor(private readonly tables: readonly FixtureTable[]) {}

  /** Answers a path below `/api/v1/experiments/{id}`, or null when it is not a data route. */
  answer(path: string, params: URLSearchParams): DataRouteAnswer | null {
    const input = Object.fromEntries(params);

    if (path === "/tables") {
      return { status: 200, body: this.tables.map((table) => this.metadata(table)) };
    }

    if (path === "/data/columns") {
      const query = zExperimentTableColumnsQuery.safeParse(input);
      if (!query.success) return this.badRequest(query.error.message);
      const table = this.find(query.data.tableName);
      if (table === undefined) return this.notFound(query.data.tableName);
      try {
        const joined = query.data.join ? this.join(table, query.data.join) : table;
        return { status: 200, body: { columns: [...joined.columns] } };
      } catch (error) {
        return this.badRequest(error instanceof Error ? error.message : String(error));
      }
    }

    if (path === "/data/distinct") {
      const query = zExperimentDistinctValuesQuery.safeParse(input);
      if (!query.success) return this.badRequest(query.error.message);
      const table = this.find(query.data.tableName);
      if (table === undefined) return this.notFound(query.data.tableName);
      const limit = query.data.limit ?? DISTINCT_VALUES_DEFAULT_LIMIT;
      return {
        status: 200,
        body: this.distinct(table, query.data.column, limit, query.data.offset ?? 0),
      };
    }

    if (path === "/data") {
      const query = zExperimentDataQuery.safeParse(input);
      if (!query.success) return this.badRequest(query.error.message);
      const table = this.find(query.data.tableName);
      if (table === undefined) return this.notFound(query.data.tableName);
      try {
        const evaluatedAt = hasRelativeTimeFilters(query.data.filters)
          ? relativeTimeMinute(Date.now())
          : undefined;
        const read = this.read(
          query.data.join ? this.join(table, query.data.join) : table,
          query.data,
          evaluatedAt ?? 0,
        );
        return {
          status: 200,
          body: [
            {
              ...read,
              ...(evaluatedAt === undefined
                ? {}
                : { filterEvaluatedAt: new Date(evaluatedAt).toISOString() }),
            },
          ],
        };
      } catch (error) {
        return this.badRequest(error instanceof Error ? error.message : String(error));
      }
    }

    return null;
  }

  // Synthetic warehouse boundary for capture only. SQL correctness is checked separately.
  private join(primary: FixtureTable, config: ExperimentDataJoin): FixtureTable {
    const secondary = this.find(config.tableName);
    if (!secondary) throw new Error("Second table not found");
    const columns = joinedColumns([...primary.columns], [...secondary.columns], config.tableName);
    const timestamp = (value: FixtureValue | undefined) =>
      typeof value === "string" ? Date.parse(value) : NaN;
    const rows = primary.rows.map((row) => {
      const time = timestamp(row[config.primaryTimeColumn]);
      const key = row[config.matchColumn];
      const candidates = secondary.rows
        .filter((other) => {
          const otherTime = timestamp(other[config.secondaryTimeColumn]);
          return (
            key != null &&
            other[config.matchColumn] === key &&
            otherTime <= time &&
            otherTime >= time - config.toleranceMinutes * 60_000
          );
        })
        .sort(
          (a, b) =>
            timestamp(b[config.secondaryTimeColumn]) - timestamp(a[config.secondaryTimeColumn]) ||
            this.compare(a.id ?? "", b.id ?? ""),
        );
      const selected = candidates.at(0);
      return {
        ...row,
        ...Object.fromEntries(
          columns.map((column) => [column.name, selected?.[column.sourceTable.columnName] ?? null]),
        ),
      };
    });
    return { ...primary, columns: [...primary.columns, ...columns], rows };
  }

  private find(tableName: string): FixtureTable | undefined {
    return this.tables.find((table) => table.identifier === tableName);
  }

  private metadata(table: FixtureTable): ExperimentTableMetadata {
    const timestamp = table.columns.find((column) => column.type_name === "TIMESTAMP");
    const times = timestamp
      ? table.rows
          .map((row) => row[timestamp.name])
          .filter((value): value is string => typeof value === "string")
      : [];
    const latest = times.reduce<string | null>(
      (newest, value) => (newest === null || value > newest ? value : newest),
      null,
    );

    return {
      identifier: table.identifier,
      tableType: "macro",
      displayName: table.displayName,
      totalRows: table.rows.length,
      latestRowAt: latest,
      schemaRevision: "fixture",
      defaultSortColumn: table.defaultSortColumn,
    };
  }

  private distinct(
    table: FixtureTable,
    column: string,
    limit: number,
    offset: number,
  ): ExperimentDistinctValuesResponse {
    const seen = new Set<string | number>();
    for (const row of table.rows) {
      const value = row[column] ?? null;
      if (value !== null) seen.add(typeof value === "boolean" ? String(value) : value);
    }

    const values = [...seen].sort((a, b) => this.compare(a, b));
    return {
      values: values.slice(offset, offset + limit),
      truncated: values.length > offset + limit,
    };
  }

  // Mirrors the repository's three branches: aggregated, filtered or projected, and plain pages.
  private read(
    table: FixtureTable,
    query: ExperimentDataQuery,
    evaluatedAt: number,
  ): ExperimentDataTable {
    const filters = resolveRelativeTimeFilters(query.filters ?? [], evaluatedAt);
    const filtered = table.rows.filter((row) =>
      filters.every((filter) => this.matches(row, filter)),
    );
    const ceiling = query.limit ?? DATA_QUERY_MAX_LIMIT;

    const hasAggregation =
      (query.aggregation?.groupBy?.length ?? 0) > 0 ||
      (query.aggregation?.functions?.length ?? 0) > 0;
    if (query.aggregation !== undefined && hasAggregation) {
      const shaped = this.aggregate(filtered, query.aggregation, table, query.orderBy);
      return this.allRows(query.tableName, this.ordered(shaped, query), ceiling);
    }

    const columns = query.columns?.split(",").map((name) => name.trim());
    const projected = this.project({ columns: [...table.columns], rows: filtered }, columns);
    const isFilteredOrProjected = filters.length > 0 || columns !== undefined;
    const hasPaging = query.page !== undefined && query.pageSize !== undefined;

    if (isFilteredOrProjected && !hasPaging) {
      return this.allRows(query.tableName, this.ordered(projected, query), ceiling);
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? PLAIN_PAGE_SIZE;
    const ordered = this.ordered(projected, query);
    const rows = ordered.rows.slice((page - 1) * pageSize, page * pageSize);
    const totalRows = ordered.rows.length;

    return {
      name: query.tableName,
      catalog_name: "fixture",
      schema_name: "centrum",
      data: { columns: ordered.columns, rows, totalRows, truncated: false },
      page,
      pageSize,
      totalRows,
      totalPages: Math.ceil(totalRows / pageSize),
    };
  }

  private allRows(tableName: string, shaped: Shaped, ceiling: number): ExperimentDataTable {
    const truncated = shaped.rows.length > ceiling;
    const rows = shaped.rows.slice(0, ceiling);

    return {
      name: tableName,
      catalog_name: "fixture",
      schema_name: "centrum",
      data: { columns: shaped.columns, rows, totalRows: shaped.rows.length, truncated },
      page: 1,
      pageSize: rows.length,
      totalRows: shaped.rows.length,
      totalPages: 1,
    };
  }

  private project(shaped: Shaped, columns: string[] | undefined): Shaped {
    if (columns === undefined) return shaped;

    const kept = columns.flatMap((name) => shaped.columns.filter((column) => column.name === name));
    const rows = shaped.rows.map((row) =>
      Object.fromEntries(kept.map((column) => [column.name, row[column.name] ?? null])),
    );
    return { columns: kept, rows };
  }

  // NULLs sort first ascending and last descending, as Databricks orders them.
  private ordered(shaped: Shaped, query: ExperimentDataQuery): Shaped {
    const orderBy = query.orderBy;
    if (orderBy === undefined) return shaped;

    const direction = query.orderDirection === "DESC" ? -1 : 1;
    const orderType = shaped.columns.find((column) => column.name === orderBy)?.type_name;
    const rows = [...shaped.rows].sort((a, b) => {
      const left = a[orderBy] ?? null;
      const right = b[orderBy] ?? null;
      if (left === null && right === null) return 0;
      if (left === null) return -direction;
      if (right === null) return direction;
      return this.compare(left, right, orderType) * direction;
    });
    return { columns: shaped.columns, rows };
  }

  private matches(
    row: FixtureRow,
    filter: ReturnType<typeof resolveRelativeTimeFilters>[number],
  ): boolean {
    const cell = this.cell(row, filter.column);
    if (cell === null) return false;

    const { value } = filter;
    const scalar = Array.isArray(value) ? null : value;
    const list: Scalar[] = Array.isArray(value) ? value : [];

    switch (filter.operator) {
      case "equals":
        return scalar !== null && this.equal(cell, scalar);
      case "not_equals":
        return scalar !== null && !this.equal(cell, scalar);
      case "greater_than":
        return scalar !== null && this.compare(cell, scalar) > 0;
      case "less_than":
        return scalar !== null && this.compare(cell, scalar) < 0;
      case "greater_than_or_equal":
        return scalar !== null && this.compare(cell, scalar) >= 0;
      case "less_than_or_equal":
        return scalar !== null && this.compare(cell, scalar) <= 0;
      case "between": {
        const start = list.at(0);
        const end = list.at(1);
        if (start === undefined || end === undefined) return false;
        return this.compare(cell, start) >= 0 && this.compare(cell, end) <= 0;
      }
      case "contains":
        return typeof scalar === "string" && this.like(String(cell), `%${scalar}%`);
      case "in":
        return list.some((item) => this.equal(cell, item));
    }
  }

  private cell(row: FixtureRow, column: string): FixtureValue {
    if (column in row) return row[column];
    const [parent, ...fields] = column.split(".");
    if (fields.length === 0 || typeof row[parent] !== "string") return null;
    try {
      let value: unknown = JSON.parse(row[parent]);
      for (const field of fields) {
        if (value === null || typeof value !== "object" || !(field in value)) return null;
        value = Reflect.get(value, field);
      }
      return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? value
        : null;
    } catch {
      return null;
    }
  }

  // SQL LIKE: case-sensitive, with % and _ as wildcards, which the backend leaves in user input.
  private like(text: string, pattern: string): boolean {
    const source = pattern
      .split("")
      .map((char) => {
        if (char === "%") return ".*";
        if (char === "_") return ".";
        return char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      })
      .join("");
    return new RegExp(`^${source}$`, "s").test(text);
  }

  private equal(cell: Scalar, value: Scalar): boolean {
    if (typeof cell === "number") return cell === Number(value);
    if (typeof cell === "boolean") return String(cell) === String(value);
    const isTime = this.isTimestamp(cell) && typeof value === "string" && this.isTimestamp(value);
    return isTime ? Date.parse(cell) === Date.parse(value) : cell === String(value);
  }

  private compare(a: Scalar, b: Scalar, type?: string): number {
    if (type === "TIMESTAMP_NTZ" && typeof a === "string" && typeof b === "string") {
      return this.windowTime(a, type) - this.windowTime(b, type);
    }
    if (typeof a === "number" && typeof b === "number") return a - b;
    if (typeof a === "number") return a - Number(b);
    if (
      typeof a === "string" &&
      typeof b === "string" &&
      this.isTimestamp(a) &&
      this.isTimestamp(b)
    ) {
      return Date.parse(a) - Date.parse(b);
    }
    return String(a).localeCompare(String(b), undefined, { numeric: true });
  }

  private compareIds(left: FixtureValue | undefined, right: FixtureValue | undefined): number {
    if (typeof left === "number" && typeof right === "number") return left - right;
    const a = String(left ?? "");
    const b = String(right ?? "");
    return a < b ? -1 : a > b ? 1 : 0;
  }

  private isTimestamp(text: string): boolean {
    return /^\d{4}-\d{2}-\d{2}/.test(text) && !Number.isNaN(Date.parse(text));
  }

  private aggregate(
    rows: FixtureRow[],
    aggregation: ExperimentDataAggregation,
    table: FixtureTable,
    orderBy: string | undefined,
  ): Shaped {
    const keys = (aggregation.groupBy ?? []).map((item) => this.groupKey(item, table));
    const functions = aggregation.functions ?? [];
    const rowFunctions = functions.filter((item) => aggregateKind(item.function) === "row");
    const cumulative = functions.filter((item) => item.function === "cumsum");

    const isWindowOnly = keys.length === 0 && rowFunctions.length === 0;
    if (isWindowOnly) return this.windowOnly(rows, functions, table, orderBy);

    const groups = new Map<string, { key: FixtureValue[]; rows: FixtureRow[] }>();
    for (const row of rows) {
      const key = keys.map((groupKey) => groupKey.valueOf(row));
      const id = JSON.stringify(key);
      const group = groups.get(id) ?? { key, rows: [] };
      group.rows.push(row);
      groups.set(id, group);
    }
    // An aggregate with no GROUP BY returns one row even over no rows.
    if (keys.length === 0 && groups.size === 0) groups.set("[]", { key: [], rows: [] });

    const out = [...groups.values()].map(({ key, rows: members }) => {
      const row: Record<string, FixtureValue> = {};
      keys.forEach((groupKey, index) => {
        row[groupKey.alias] = key[index] ?? null;
      });
      for (const item of rowFunctions) row[this.alias(item)] = this.reduce(members, item, table);
      return { row, members };
    });

    const first = keys.at(0);
    for (const item of cumulative) {
      if (first === undefined && orderBy === undefined) {
        throw new Error(
          "Cumulative sum needs an X column or orderBy parameter to define the running-total order",
        );
      }
      const orderKey = first?.alias ?? orderBy ?? "";
      const orderType =
        first?.type ?? table.columns.find((column) => column.name === orderBy)?.type_name;
      const sums = out.map(({ row, members }) => ({
        order: row[orderKey] ?? null,
        amount: item.column === "*" ? members.length : this.total(members, item.column),
      }));
      for (const entry of out) {
        const at = entry.row[orderKey] ?? null;
        entry.row[this.alias(item)] = sums
          .filter(
            (sum) =>
              sum.order === null || (at !== null && this.compare(sum.order, at, orderType) <= 0),
          )
          .reduce((running, sum) => running + sum.amount, 0);
      }
    }

    const columns = [
      ...keys.map((groupKey) => ({
        name: groupKey.alias,
        type_name: groupKey.type,
        type_text: groupKey.type,
      })),
      ...rowFunctions.map((item) => this.functionColumn(item, table)),
      ...cumulative.map((item) => this.functionColumn(item, table)),
    ];
    return { columns, rows: out.map(({ row }) => row) };
  }

  // Raw windows keep every filtered row. Cumsum uses RANGE peers; row windows use id ties.
  private windowOnly(
    rows: FixtureRow[],
    functions: ExperimentAggregationItem[],
    table: FixtureTable,
    orderBy: string | undefined,
  ): Shaped {
    if (functions.some((item) => item.function === "cumsum") && orderBy === undefined) {
      throw new Error(
        "Cumulative sum needs an X column or orderBy parameter to define the running-total order",
      );
    }

    const orderType = table.columns.find((column) => column.name === orderBy)?.type_name;
    const out = rows.map((row) => {
      const at = row[orderBy ?? ""] ?? null;
      const peers = rows.filter((other) => {
        const order = other[orderBy ?? ""] ?? null;
        return order === null || (at !== null && this.compare(order, at, orderType) <= 0);
      });
      const extra: Record<string, FixtureValue> = {};
      for (const item of functions) {
        if (item.function === "cumsum") {
          extra[this.alias(item)] =
            item.column === "*" ? peers.length : this.total(peers, item.column);
          continue;
        }
        if (row[item.orderColumn ?? ""] == null) {
          extra[this.alias(item)] = null;
          continue;
        }
        const partition = rows.filter(
          (other) =>
            !item.partitionColumn || other[item.partitionColumn] === row[item.partitionColumn],
        );
        const windowOrderType = table.columns.find(
          (column) => column.name === item.orderColumn,
        )?.type_name;
        const ordered = [...partition];
        // Undated rows sort last and cannot supply a previous value to dated rows.
        ordered.sort((a, b) => {
          const left = a[item.orderColumn ?? ""] ?? null;
          const right = b[item.orderColumn ?? ""] ?? null;
          return (
            (left === null && right === null
              ? 0
              : left === null
                ? 1
                : right === null
                  ? -1
                  : this.compare(left, right, windowOrderType)) ||
            (table.columns.some((column) => column.name === "id") ? this.compareIds(a.id, b.id) : 0)
          );
        });
        const index = ordered.indexOf(row);
        const previous = ordered[index - 1]?.[item.column] ?? null;
        const current = row[item.column] ?? null;
        let value: FixtureValue;
        if (item.function === "row_number") value = index + 1;
        else if (item.function === "previous") value = previous;
        else if (item.function === "change_from_previous") {
          const type = table.columns.find((column) => column.name === item.column)?.type_name;
          if (type && /^(TIMESTAMP|TIMESTAMP_NTZ|DATE)$/.test(type)) {
            value =
              previous === null || current === null
                ? null
                : (this.windowTime(current, type) - this.windowTime(previous, type)) / 1000;
          } else {
            if (current !== null && typeof current !== "number")
              throw new Error("Change from previous requires numeric or temporal values");
            value =
              typeof previous === "number" && typeof current === "number"
                ? current - previous
                : null;
          }
        } else throw new Error(`Unsupported raw window: ${item.function}`);
        extra[this.alias(item)] = value;
      }
      return { ...row, ...extra };
    });

    const columns = [
      ...table.columns,
      ...functions.map((item) => this.functionColumn(item, table)),
    ];
    return { columns, rows: out };
  }

  private windowTime(value: FixtureValue, type: string): number {
    const text = String(value);
    const zoneless = type === "TIMESTAMP_NTZ" && !/(?:Z|[+-]\d{2}:\d{2})$/i.test(text);
    return Date.parse(zoneless ? `${text}Z` : text);
  }

  private groupKey(item: ExperimentGroupByItem, table: FixtureTable): GroupKey {
    const source = table.columns.find((column) => column.name === item.column);
    const { timeBucket, widthBucket } = item;

    if (timeBucket !== undefined) {
      return {
        alias: `${item.column}_${timeBucket}`,
        type: "TIMESTAMP",
        valueOf: (row) => this.truncate(row[item.column] ?? null, timeBucket),
      };
    }

    if (widthBucket !== undefined) {
      return {
        alias: `${item.column}_bucket`,
        type: "BIGINT",
        valueOf: (row) => {
          const value = row[item.column] ?? null;
          const position =
            widthBucket.scale === "time" && typeof value === "string"
              ? Date.parse(value)
              : typeof value === "number"
                ? value
                : Number.NaN;
          if (Number.isNaN(position)) return null;
          return Math.floor((position - widthBucket.origin) / widthBucket.width);
        },
      };
    }

    return {
      alias: item.column,
      type: source?.type_name ?? "STRING",
      valueOf: (row) => row[item.column] ?? null,
    };
  }

  // date_trunc in UTC; a week starts on Monday, as Databricks counts it.
  private truncate(value: FixtureValue, unit: ExperimentTimeBucketUnit): string | null {
    if (typeof value !== "string" || !this.isTimestamp(value)) return null;

    const date = new Date(value);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const startOfDay = Date.UTC(year, month, date.getUTCDate());

    const start = {
      minute: () =>
        Date.UTC(year, month, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes()),
      hour: () => Date.UTC(year, month, date.getUTCDate(), date.getUTCHours()),
      day: () => startOfDay,
      week: () => startOfDay - ((date.getUTCDay() + 6) % 7) * 86_400_000,
      month: () => Date.UTC(year, month, 1),
      quarter: () => Date.UTC(year, Math.floor(month / 3) * 3, 1),
      year: () => Date.UTC(year, 0, 1),
    }[unit]();
    return new Date(start).toISOString();
  }

  private alias(item: ExperimentAggregationItem): string {
    if (item.alias !== undefined) return item.alias;
    if (item.function === "row_number") return `${item.column}_row_number`;
    if (item.function === "corr") return `${item.column}_corr_${item.secondColumn ?? ""}`;
    const base = item.column === "*" ? "count" : item.column;
    return `${base}_${item.function}`;
  }

  private functionColumn(
    item: ExperimentAggregationItem,
    table: FixtureTable,
  ): ExperimentDataColumn {
    const source = table.columns.find((column) => column.name === item.column);
    const keepsType =
      ["min", "max", "previous", "latest", "earliest"].includes(item.function) ||
      (item.function === "change_from_previous" && isNumericType(source?.type_text));
    const type =
      item.function === "count" ||
      item.function === "count_distinct" ||
      item.function === "row_number"
        ? "BIGINT"
        : keepsType
          ? (source?.type_name ?? "DOUBLE")
          : "DOUBLE";
    return {
      name: this.alias(item),
      type_name: type,
      type_text: keepsType ? (source?.type_text ?? type) : type,
    };
  }

  private total(rows: FixtureRow[], column: string): number {
    return this.numbers(rows, column).reduce((sum, value) => sum + value, 0);
  }

  private numbers(rows: FixtureRow[], column: string): number[] {
    return rows
      .map((row) => row[column])
      .filter((value): value is number => typeof value === "number");
  }

  // STDDEV and VARIANCE are the sample forms, NULL below two values.
  private reduce(
    rows: FixtureRow[],
    item: ExperimentAggregationItem,
    table: FixtureTable,
  ): FixtureValue {
    if (item.function === "latest" || item.function === "earliest") {
      const candidates = rows.filter((row) => row[item.orderColumn ?? ""] != null);
      const direction = item.function === "latest" ? -1 : 1;
      const hasId = table.columns.some((column) => column.name === "id");
      const orderType = table.columns.find((column) => column.name === item.orderColumn)?.type_name;
      const ordered = [...candidates].sort((a, b) => {
        const order = this.compare(
          a[item.orderColumn ?? ""] ?? "",
          b[item.orderColumn ?? ""] ?? "",
          orderType,
        );
        return (order || (hasId ? this.compareIds(a.id, b.id) : 0)) * direction;
      });
      return ordered[0]?.[item.column] ?? null;
    }
    if (item.function === "count_distinct") {
      return new Set(rows.map((row) => row[item.column] ?? null).filter((value) => value !== null))
        .size;
    }
    if (item.function === "count") {
      return item.column === "*"
        ? rows.length
        : rows.filter((row) => (row[item.column] ?? null) !== null).length;
    }
    if (item.function === "corr")
      return this.correlation(rows, item.column, item.secondColumn ?? "");

    const values = this.numbers(rows, item.column);
    if (values.length === 0) {
      if (item.function === "min" || item.function === "max") {
        return this.extreme(rows, item.column, item.function);
      }
      return null;
    }

    const sum = values.reduce((total, value) => total + value, 0);
    const mean = sum / values.length;
    const variance =
      values.length < 2
        ? null
        : values.reduce((total, value) => total + (value - mean) ** 2, 0) / (values.length - 1);

    switch (item.function) {
      case "sum":
        return sum;
      case "avg":
        return mean;
      case "min":
        return Math.min(...values);
      case "max":
        return Math.max(...values);
      case "std":
        return variance === null ? null : Math.sqrt(variance);
      case "var":
        return variance;
      case "cumsum":
        return sum;
      default:
        throw new Error(`Unsupported grouped aggregate: ${item.function}`);
    }
  }

  // MIN and MAX also order text, such as timestamps.
  private extreme(rows: FixtureRow[], column: string, fn: "min" | "max"): FixtureValue {
    const values = rows
      .map((row) => row[column] ?? null)
      .filter((value): value is string => typeof value === "string");
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => this.compare(a, b));
    return (fn === "min" ? sorted.at(0) : sorted.at(-1)) ?? null;
  }

  private correlation(rows: FixtureRow[], first: string, second: string): number | null {
    const pairs = rows.flatMap((row) => {
      const x = row[first];
      const y = row[second];
      return typeof x === "number" && typeof y === "number" ? [{ x, y }] : [];
    });
    if (pairs.length < 2) return null;

    const meanX = pairs.reduce((total, pair) => total + pair.x, 0) / pairs.length;
    const meanY = pairs.reduce((total, pair) => total + pair.y, 0) / pairs.length;
    let covariance = 0;
    let spreadX = 0;
    let spreadY = 0;
    for (const { x, y } of pairs) {
      covariance += (x - meanX) * (y - meanY);
      spreadX += (x - meanX) ** 2;
      spreadY += (y - meanY) ** 2;
    }
    if (spreadX === 0 || spreadY === 0) return null;
    return covariance / Math.sqrt(spreadX * spreadY);
  }

  private badRequest(message: string): DataRouteAnswer {
    return { status: 400, body: { message } };
  }

  private notFound(tableName: string): DataRouteAnswer {
    return { status: 404, body: { message: `No fixture table ${tableName}` } };
  }
}
