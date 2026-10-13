import {
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
  ExperimentDataFilter,
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
      return { status: 200, body: { columns: [...table.columns] } };
    }

    if (path === "/data/distinct") {
      const query = zExperimentDistinctValuesQuery.safeParse(input);
      if (!query.success) return this.badRequest(query.error.message);
      const table = this.find(query.data.tableName);
      if (table === undefined) return this.notFound(query.data.tableName);
      const limit = query.data.limit ?? DISTINCT_VALUES_DEFAULT_LIMIT;
      return { status: 200, body: this.distinct(table, query.data.column, limit) };
    }

    if (path === "/data") {
      const query = zExperimentDataQuery.safeParse(input);
      if (!query.success) return this.badRequest(query.error.message);
      const table = this.find(query.data.tableName);
      if (table === undefined) return this.notFound(query.data.tableName);
      try {
        return { status: 200, body: [this.read(table, query.data)] };
      } catch (error) {
        return this.badRequest(error instanceof Error ? error.message : String(error));
      }
    }

    return null;
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
  ): ExperimentDistinctValuesResponse {
    const seen = new Set<string | number>();
    for (const row of table.rows) {
      const value = row[column] ?? null;
      if (value !== null) seen.add(typeof value === "boolean" ? String(value) : value);
    }

    const values = [...seen].sort((a, b) => this.compare(a, b));
    return { values: values.slice(0, limit), truncated: values.length > limit };
  }

  // Mirrors the repository's three branches: aggregated, filtered or projected, and plain pages.
  private read(table: FixtureTable, query: ExperimentDataQuery): ExperimentDataTable {
    const filters = query.filters ?? [];
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
    const rows = [...shaped.rows].sort((a, b) => {
      const left = a[orderBy] ?? null;
      const right = b[orderBy] ?? null;
      if (left === null && right === null) return 0;
      if (left === null) return -direction;
      if (right === null) return direction;
      return this.compare(left, right) * direction;
    });
    return { columns: shaped.columns, rows };
  }

  private matches(row: FixtureRow, filter: ExperimentDataFilter): boolean {
    const cell = row[filter.column] ?? null;
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

  private compare(a: Scalar, b: Scalar): number {
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
    const rowFunctions = functions.filter((item) => item.function !== "cumsum");
    const cumulative = functions.filter((item) => item.function === "cumsum");

    const isWindowOnly = keys.length === 0 && rowFunctions.length === 0;
    if (isWindowOnly) return this.windowOnly(rows, cumulative, table, orderBy);

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
      for (const item of rowFunctions) row[this.alias(item)] = this.reduce(members, item);
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
      const sums = out.map(({ row, members }) => ({
        order: row[orderKey] ?? null,
        amount: item.column === "*" ? members.length : this.total(members, item.column),
      }));
      for (const entry of out) {
        const at = entry.row[orderKey] ?? null;
        entry.row[this.alias(item)] = sums
          .filter((sum) => sum.order === null || (at !== null && this.compare(sum.order, at) <= 0))
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

  // Cumulative sums alone keep every raw row, the running total ordered by `orderBy`.
  private windowOnly(
    rows: FixtureRow[],
    cumulative: ExperimentAggregationItem[],
    table: FixtureTable,
    orderBy: string | undefined,
  ): Shaped {
    if (orderBy === undefined) {
      throw new Error(
        "Cumulative sum needs an X column or orderBy parameter to define the running-total order",
      );
    }

    const out = rows.map((row) => {
      const at = row[orderBy] ?? null;
      const peers = rows.filter((other) => {
        const order = other[orderBy] ?? null;
        return order === null || (at !== null && this.compare(order, at) <= 0);
      });
      const extra: Record<string, FixtureValue> = {};
      for (const item of cumulative) {
        extra[this.alias(item)] =
          item.column === "*" ? peers.length : this.total(peers, item.column);
      }
      return { ...row, ...extra };
    });

    const columns = [
      ...table.columns,
      ...cumulative.map((item) => this.functionColumn(item, table)),
    ];
    return { columns, rows: out };
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
    if (item.function === "corr") return `${item.column}_corr_${item.secondColumn ?? ""}`;
    const base = item.column === "*" ? "count" : item.column;
    return `${base}_${item.function}`;
  }

  private functionColumn(
    item: ExperimentAggregationItem,
    table: FixtureTable,
  ): ExperimentDataColumn {
    const source = table.columns.find((column) => column.name === item.column);
    const keepsType = item.function === "min" || item.function === "max";
    const type =
      item.function === "count" ? "BIGINT" : keepsType ? (source?.type_name ?? "DOUBLE") : "DOUBLE";
    return { name: this.alias(item), type_name: type, type_text: type };
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
  private reduce(rows: FixtureRow[], item: ExperimentAggregationItem): FixtureValue {
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
