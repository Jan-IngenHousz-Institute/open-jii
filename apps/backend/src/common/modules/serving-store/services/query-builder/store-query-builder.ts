import { ORDER_COLUMN_REQUIRED_MESSAGE } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentDataFlagged } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { isNumericType } from "@repo/api/transforms/column-type-utils";

import type { StoreMetadataSheet } from "../../../../../experiments/core/ports/serving-store.port";
import type { NamedOutput } from "../../../databricks/services/query-builder/expressions/aggregation";
import { deviceLabel } from "../../../databricks/services/query-builder/expressions/device-label";
import { numericStringOrdering } from "../../../databricks/services/query-builder/expressions/numeric-string-order";
import type { NumericStringKeys } from "../../../databricks/services/query-builder/expressions/numeric-string-order";
import { buildWindowSpec } from "../../../databricks/services/query-builder/expressions/window";
import { BaseQueryBuilder } from "../../../databricks/services/query-builder/query-builder.base";
import type {
  AggregateExpression,
  FilterCondition,
  FilterValue,
  QueryOrdering,
  TimeBucketUnit,
  WidthBucket,
} from "../../../databricks/services/query-builder/query-builder.types";
import { QueryBuilderInputError } from "../../../databricks/services/query-builder/query-builder.types";
import { FlattenedFields } from "../../../databricks/services/query-builder/schema/flattened-fields";
import type {
  FlattenedField,
  FlattenedSource,
} from "../../../databricks/services/query-builder/schema/flattened-fields";
import { VariantSchema } from "../../../databricks/services/query-builder/schema/variant-schema";
import type { VariantField } from "../../../databricks/services/query-builder/schema/variant-schema";
import { SparkWidthBucket } from "./spark-width-bucket";
import type { DeviceParts, StoreColumn, StoreTable } from "./store-tables";

export type StoreOutputColumn = Pick<StoreColumn, "name" | "type" | "idOf" | "isPairText"> & {
  text?: { column: string; key?: string };
};

/** A column the rows first kept sort by going up, and where its nulls go. */
export interface FirstRowsTerm {
  column: string;
  nulls: "FIRST" | "LAST";
}

/** The order the rows first kept are chosen in, and whether rows tied with the last are kept too. */
export interface FirstRows {
  order: FirstRowsTerm[];
  withTies: boolean;
}

/** The second table of an as-of read, one row per key and time. */
export interface StoreAsOfSecondary {
  sql: string;
  columns: StoreOutputColumn[];
  readsTable: boolean;
}

/** The names of the id lists a statement's WITH clause holds, which no payload field may take. */
const ORDER_IDS = "__order_ids";
const DEVICE_CLIENT_IDS = "__device_client_ids";
const DEVICE_SERIALS = "__device_serials";
const FLAGGED_ROW_IDS = "__flagged_row_ids";

const CUSTOM_METADATA = "custom_metadata";

const STORE_SCALARS: Record<string, string> = {
  STRING: "String",
  BIGINT: "Int64",
  INT: "Int32",
  DOUBLE: "Float64",
  BOOLEAN: "Bool",
};

/** Spark keeps central moments; the store's plain spreads drift where values sit far from zero. */
const SAMPLE_SPREADS: Record<"std" | "var", string> = {
  std: "stddevSampStable",
  var: "varSampStable",
};

const INTEGER_TYPES = new Set(["BIGINT", "INT"]);

/** Lag and row numbers count rows, so they see every row before this one, never its peers. */
const ROWS_SO_FAR = "ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW";

/** The names an as-of read gives its two tables and the second's own columns. */
const ASOF_PRIMARY = "__asof_primary";
const ASOF_SECONDARY = "__asof_secondary";
const ASOF_KEY = "__asof_key";
const ASOF_TIME = "__asof_time";
const ASOF_FOUND = "__asof_found";
const ASOF_LABEL = "__asof_label_";

/**
 * Reads one experiment table from the store's views in the warehouse's shape: the view's columns
 * under its names, and each payload field flattened as the variant builder flattens it. Filters
 * and sorts name the same columns and fields a warehouse read does, and compare as Spark compares.
 * It extends the warehouse's builder rather than copying it, so the filter operators, payload
 * field names and schema parsing a page depends on stay one implementation for both reads.
 */
export class StoreQueryBuilder extends BaseQueryBuilder {
  static readonly reservedNames: readonly string[] = [
    ORDER_IDS,
    DEVICE_CLIENT_IDS,
    DEVICE_SERIALS,
    FLAGGED_ROW_IDS,
  ];

  private experiment = "";
  private fromClause = "";
  /** The table a chart reads with FINAL, which an alias must come before. */
  private finalTable?: string;
  private joinsTable = false;
  private firstRows?: FirstRows & { count: number };
  private columns: StoreColumn[] = [];
  private key: string[] = [];
  private payloadTexts: Partial<Record<string, string>> = {};
  private phoneAnnotations?: string;
  private takesCustomMetadata = false;
  private selectColumns?: string[];
  private variantColumns: FlattenedSource[] = [];
  private reservedColumns: string[] = [];
  private exceptColumns: string[] = [];
  private whereConditions: string[] = [];
  private filterColumns: string[] = [];
  private deviceSerials: [string, string | null][] = [];
  private flaggedRowIds?: string[];
  private sheets: (StoreMetadataSheet & {
    fields: ReadonlySet<string>;
    nestsObjects: boolean;
  })[] = [];
  private ordering?: QueryOrdering;
  private idOrder?: string[];
  private limitValue?: number;
  private offsetValue?: number;
  private plotsValues = false;
  private rowNames = new Set<string>();
  private rowTypes = new Map<string, string>();
  private outputTypeOf?: (output: NamedOutput) => string | undefined;
  private rowIds = new Map<string, "contributor" | "device">();
  /** Kept until a payload, a reserved name or a sheet changes them. */
  private fields?: Map<string, FlattenedField>;
  private expressions?: Map<string, string>;

  read(table: StoreTable, experimentId: string, identifier?: string): this {
    this.columnsOf(table, experimentId, identifier);
    return this.from(`${table.view}(experiment = ${this.experiment})`);
  }

  /**
   * A chart's read of the table itself, which reads only the payload paths it names where the
   * view would read whole payloads. The reader's row policy keeps it to the experiment the read
   * sends as its setting, and FINAL merges each row's copies, as the view does. Payload fields
   * read as the values a chart plots, not as the text a page shows.
   */
  readForChart(table: StoreTable, experimentId: string, identifier?: string): this {
    this.columnsOf(table, experimentId, identifier);
    this.where(`experiment_id = ${this.experiment}`);
    this.plotsValues = true;
    this.finalTable = table.table;
    return this.from(`${table.table} FINAL`);
  }

  /** Whether the statement names a table rather than a view, which the reader's row policy guards. */
  readsTables(): boolean {
    return this.finalTable !== undefined || this.joinsTable;
  }

  private columnsOf(table: StoreTable, experimentId: string, identifier?: string): void {
    this.experiment = this.escapeValue(experimentId);
    this.columns = table.columns;
    this.key = table.key;
    this.payloadTexts = table.payloadTexts ?? {};
    this.phoneAnnotations = table.phoneAnnotations;
    this.takesCustomMetadata = table.takesCustomMetadata ?? false;
    this.reservedColumns.push(...StoreQueryBuilder.reservedNames);
    this.forgetFields();
    if (table.identifierColumn !== undefined && identifier !== undefined) {
      this.where(`${table.identifierColumn} = ${this.escapeValue(identifier)}`);
    }
  }

  select(columns?: string[]): this {
    if (columns && columns.length > 0) {
      this.selectColumns = columns;
    }
    return this;
  }

  from(source: string): this {
    this.fromClause = source;
    return this;
  }

  parseVariant(column: string, schema: string, suffix = column): this {
    this.variantColumns.push({ column, schema, suffix });
    this.forgetFields();
    return this;
  }

  reserve(columns: string[]): this {
    this.reservedColumns.push(...columns);
    this.forgetFields();
    return this;
  }

  except(columns: string[]): this {
    this.exceptColumns.push(...columns);
    return this;
  }

  /** Each registered device's client id with the serial number its label shows, or none; any
   *  other device reads none. */
  serialNumbers(serials: [string, string | null][]): this {
    this.deviceSerials = serials;
    return this;
  }

  /** The experiment's metadata sheets, oldest first, which a read of custom metadata joins. */
  metadataSheets(sheets: StoreMetadataSheet[]): this {
    this.sheets = sheets.map((sheet) => {
      const fields = sheet.schema === null ? [] : VariantSchema.topLevelFields(sheet.schema);
      return {
        ...sheet,
        fields: new Set(fields.map(({ name }) => name)),
        nestsObjects: fields.some(({ type }) => /OBJECT<|VARIANT/.test(type)),
      };
    });
    this.forgetFields();
    return this;
  }

  /**
   * Reads only the rows first in `order`, found by their keys over the key and order columns alone,
   * as a sorted page finds its rows; the rest of each row is read for those rows only.
   */
  keepFirst(rows: FirstRows, count: number): this {
    this.firstRows = { ...rows, count };
    return this;
  }

  /** Writes a statement over another's rows, whose contributors and devices are held as ids. */
  over(columns: StoreOutputColumn[]): this {
    this.rowNames = new Set(columns.map(({ name }) => name));
    this.rowTypes = new Map(columns.map(({ name, type }) => [name, type]));
    this.rowIds = new Map(
      columns.flatMap(({ name, idOf }) => (idOf === undefined ? [] : [[name, idOf]])),
    );
    return this;
  }

  /** Over another's rows a contributor is its id, and a device the pair of its key and label. */
  escapeIdentifier(identifier: string): string {
    const [name, path] = this.structPath(identifier);
    const idOf = this.rowIdOf(identifier);

    const isContributorId = idOf === "contributor" && path === "id";
    if (isContributorId) {
      return this.quoteName(name);
    }
    const isSerialNumber = idOf === "device" && path === "serial_number";
    if (isSerialNumber) {
      return `tupleElement(${this.quoteName(name)}, 2)`;
    }
    return super.escapeIdentifier(identifier);
  }

  where(condition: string): this {
    this.whereConditions.push(condition);
    return this;
  }

  override filter(condition: FilterCondition): this {
    this.filterColumns.push(condition.column);
    return super.filter(condition);
  }

  /**
   * Keeps the rows with a flag, or the rows without one. A flag counts whether the phone recorded
   * it with the measurement or someone added it afterwards, as `addedRowIds` from Postgres say.
   */
  flagged(kind: ExperimentDataFlagged, addedRowIds: string[]): this {
    this.flaggedRowIds = addedRowIds;
    // A set the store builds once; has() would search the whole list for every row.
    const added = `toString(id) IN (SELECT arrayJoin(${FLAGGED_ROW_IDS}))`;
    const flaggedCondition =
      this.phoneAnnotations === undefined
        ? added
        : `(${added} OR arrayExists(annotation -> tupleElement(annotation, 'type') = 'flag', ${this.phoneAnnotations}))`;
    return this.where(kind === "only" ? flaggedCondition : `NOT ${flaggedCondition}`);
  }

  /**
   * `idOrder` sorts by what the store does not hold, a contributor's name or a device's registry
   * id, by the place of each row's id in it; names never enter a query, whose text the store logs.
   */
  orderBy(ordering: QueryOrdering, idOrder?: string[]): this {
    this.ordering = ordering;
    return this.followIds(idOrder);
  }

  followIds(idOrder: string[] | undefined): this {
    this.idOrder = idOrder;
    return this;
  }

  limit(value: number): this {
    this.limitValue = value;
    return this;
  }

  offset(value: number): this {
    this.offsetValue = value;
    return this;
  }

  columnExpression(column: string): string {
    const field = this.fieldExpressions().get(column);
    if (field !== undefined) {
      return field;
    }

    const [name, path] = this.structPath(column);
    const base = this.baseColumn(name);
    if (path === undefined) {
      return base.expression;
    }

    const isContributorId = base.idOf === "contributor" && path === "id";
    if (isContributorId) {
      return base.expression;
    }
    const isSerialNumber = base.idOf === "device" && path === "serial_number";
    if (isSerialNumber) {
      return this.devicePartsOf(base).label;
    }
    throw new QueryBuilderInputError(`The store cannot read '${column}'`);
  }

  /** A literal of the column's own type: the store compares no text with a number, and reads a
   *  time only in its own format. Text compared with a payload's number reads as Spark casts it,
   *  so text that holds no number matches no row, as on the warehouse; a number listed with that
   *  text reads as a double, as the column then does. */
  filterLiteral(
    column: string,
    value: Exclude<FilterValue, (string | number)[]>,
    compared: FilterValue = value,
  ): string {
    const type = this.typeOf(column);
    const isTime = type === "TIMESTAMP" || type === "DATE";
    if (isTime && typeof value !== "string") {
      throw new QueryBuilderInputError(`'${column}' is compared with a time given as text`);
    }
    const isTextAgainstNumber = isNumericType(type) && typeof value === "string";
    const isField = this.flattenedFields().has(column);
    if (isTextAgainstNumber && isField) {
      return this.textAsDouble(this.escapeValue(value));
    }
    if (isTextAgainstNumber && !this.readsAsNumber(value, type)) {
      throw new QueryBuilderInputError(`'${column}' is compared with a number`);
    }
    if (typeof value === "string" && type === "TIMESTAMP") {
      return `parseDateTime64BestEffortOrNull(${this.escapeValue(value)}, 6, 'UTC')`;
    }
    if (typeof value === "string" && type === "DATE") {
      return `toDate(parseDateTime64BestEffortOrNull(${this.escapeValue(value)}, 6, 'UTC'))`;
    }
    if (typeof value !== "string" && type === "STRING") {
      return this.escapeValue(String(value));
    }
    if (typeof value === "number" && this.isComparedAsDouble(column, compared)) {
      return `toFloat64(${this.escapeScalarValue(value)})`;
    }

    // Spark reads a plain number as a decimal literal, which it compares with a decimal exactly;
    // the store would read a Float64 and compare the decimal through an inexact conversion.
    const text = typeof value === "number" ? String(value) : "";
    const isDecimalAgainstPlainNumber =
      VariantSchema.decimalOf(type) !== null && /^-?\d+(\.\d+)?$/.test(text);
    if (isDecimalAgainstPlainNumber) {
      const [, fraction = ""] = text.split(".");
      return `toDecimal256(${this.escapeValue(text)}, ${fraction.length})`;
    }
    return this.escapeScalarValue(value);
  }

  /** Spark compares a payload's integer or decimal with text as two doubles, so text past 2^53
   *  matches every integer that rounds to its double; the store compares them the same way. */
  comparedColumn(columnSql: string, column: string, value: FilterValue): string {
    return this.isComparedAsDouble(column, value) ? `toFloat64(${columnSql})` : columnSql;
  }

  private isComparedAsDouble(column: string, value: FilterValue): boolean {
    const field = this.flattenedFields().get(column);
    const type = this.variantCastType(field?.field.type ?? "");
    const isNumberField = type === "BIGINT" || VariantSchema.decimalOf(type) !== null;
    const isText = (Array.isArray(value) ? value : [value]).some(
      (item) => typeof item === "string",
    );
    return isNumberField && isText;
  }

  /** The store reads text as a number column's value only as plain digits, with a fraction where
   *  the type holds one. */
  private readsAsNumber(text: string, type: string): boolean {
    return this.isIntegerType(type) ? /^-?\d+$/.test(text) : /^-?\d+(\.\d+)?$/.test(text);
  }

  /** Integers leave the store as text, since an id or a sum may pass 2^53. */
  isIntegerType(type: string): boolean {
    return INTEGER_TYPES.has(type);
  }

  /** A decimal reads as text at its scale, as its cell shows it: 5 at scale 2 is 5.00. */
  textOf(columnSql: string, column: string): string {
    const decimal = VariantSchema.decimalOf(this.typeOf(column));
    return decimal === null
      ? `toString(${columnSql})`
      : `toDecimalString(${columnSql}, ${decimal.scale})`;
  }

  contributorPseudonym(idSql: string, salt: string): string {
    const prefix = this.escapeValue(`${salt}:`);
    return `concat('Contributor-', substring(hex(SHA256(concat(${prefix}, ${idSql}))), 1, 6))`;
  }

  /** Spark truncates in its UTC session and gives a time even for a date, a week from Monday. */
  buildTimeBucketExpression(column: string, unit: TimeBucketUnit): { sql: string; alias: string } {
    const instant = this.instantOf(this.escapeIdentifier(column));
    return {
      sql: `toDateTime64(dateTrunc('${unit}', ${instant}), 6, 'UTC')`,
      alias: `${column}_${unit}`,
    };
  }

  buildWidthBucketExpression(
    column: string,
    bucket: WidthBucket,
    alias?: string,
  ): { sql: string; alias: string } {
    const escaped = this.escapeIdentifier(column);
    const position =
      bucket.scale === "time" ? `toUnixTimestamp64Milli(${this.instantOf(escaped)})` : escaped;
    // A contributor's or device's field, which no row type names, is text.
    const division = new SparkWidthBucket(this.rowTypes.get(column) ?? "STRING", bucket);
    return { sql: division.sql(position), alias: alias ?? `${column}_bucket` };
  }

  buildAggregateExpression(agg: AggregateExpression): { sql: string; alias: string } {
    const alias = this.aggregateAlias(agg);
    const column = agg.column === "*" ? "*" : this.escapeIdentifier(agg.column);
    // Over values that may be null an empty input gives null, as Spark's does, not the store's zero.
    const value = `toNullable(${column})`;

    switch (agg.function) {
      case "sum":
      case "avg":
      case "min":
      case "max":
        return { sql: `${agg.function}(${value})`, alias };
      case "count":
        return { sql: agg.column === "*" ? "count()" : `count(${column})`, alias };
      case "count_distinct":
        return { sql: `count(DISTINCT ${column})`, alias };
      case "std":
      case "var":
        // Spark's sample spreads are null below two values, where the store's are NaN.
        return {
          sql: `if(count(${value}) > 1, ${SAMPLE_SPREADS[agg.function]}(${value}), NULL)`,
          alias,
        };
      case "corr": {
        if (agg.secondColumn === undefined) {
          throw new QueryBuilderInputError(
            "buildAggregateExpression: 'corr' requires a secondColumn",
          );
        }
        // Below two pairs or over a constant series there is no correlation, so no value.
        const corr = `corrStable(${value}, toNullable(${this.escapeIdentifier(agg.secondColumn)}))`;
        return { sql: `if(isFinite(${corr}), ${corr}, NULL)`, alias };
      }
      case "latest":
      case "earliest": {
        // The value rides in a tuple, which is never null, so a null value at the newest key is
        // the answer as it is for Spark's MAX_BY, instead of a row the store skips.
        const order = this.escapeIdentifier(this.orderColumnOf(agg));
        const key = agg.tieBreaker
          ? `tuple(${order}, ${this.escapeIdentifier(agg.tieBreaker)})`
          : order;
        const pick = agg.function === "latest" ? "argMaxIf" : "argMinIf";
        return {
          sql: `tupleElement(${pick}(tuple(${value}), ${key}, ${order} IS NOT NULL), 1)`,
          alias,
        };
      }
      case "cumsum":
        throw new QueryBuilderInputError(
          "buildAggregateExpression: cumsum is a window function, route through buildCumsumExpression",
        );
      case "previous":
      case "change_from_previous":
      case "row_number":
        throw new QueryBuilderInputError("Row windows must use the window-only query path");
    }
  }

  /** A running sum grouped first by device accumulates in the order Spark sorts its struct. */
  buildCumsumExpression(
    agg: AggregateExpression,
    opts: { orderBy: string; orderColumn?: string; grouped: boolean },
  ): { sql: string; alias: string } {
    const value = (() => {
      if (agg.column === "*") {
        return opts.grouped ? "count()" : "1";
      }
      const column = this.escapeIdentifier(agg.column);
      return opts.grouped ? `sum(toNullable(${column}))` : column;
    })();
    const order =
      opts.orderColumn === undefined
        ? `${opts.orderBy} ASC NULLS FIRST`
        : this.aggregateOrdering(opts.orderBy, { column: opts.orderColumn, direction: "ASC" });
    return {
      sql: `sum(${value}) OVER (ORDER BY ${order})`,
      alias: this.aggregateAlias(agg),
    };
  }

  buildRowWindowExpression(item: AggregateExpression): { sql: string; alias: string } {
    const alias = this.aggregateAlias(item);
    const order = this.escapeIdentifier(this.orderColumnOf(item));
    const window = `OVER (${buildWindowSpec(item, this)} ${ROWS_SO_FAR})`;
    const result = (sql: string) => ({
      sql: `CASE WHEN ${order} IS NULL THEN NULL ELSE ${sql} END`,
      alias,
    });
    if (item.function === "row_number") {
      return result(`row_number() ${window}`);
    }

    const column = this.escapeIdentifier(item.column);
    const previous = `lagInFrame(toNullable(${column})) ${window}`;
    if (item.function === "previous") {
      return result(previous);
    }
    const type = item.valueType?.trim().toUpperCase();
    if (type === undefined || isNumericType(type)) {
      return result(`(${column} - ${previous})`);
    }
    const isTime = type === "TIMESTAMP" || type === "TIMESTAMP_NTZ" || type === "DATE";
    if (!isTime) {
      throw new QueryBuilderInputError(
        "Change from previous requires a numeric, timestamp or date column",
      );
    }
    const micros = (sql: string) => `toUnixTimestamp64Micro(${sql})`;
    const instant = this.instantOf(column);
    const before = `lagInFrame(toNullable(${instant})) ${window}`;
    return result(`(${micros(instant)} - ${micros(before)}) / 1e6`);
  }

  /**
   * Spark sorts a device's struct by its registry id, which only the ids in the order carry, and a
   * contributor by name in the order of its ids; nulls go first going up and last going down.
   */
  aggregateOrdering(
    target: string,
    { column, direction = "ASC" }: QueryOrdering,
    output?: NamedOutput,
  ): string {
    const nulls = direction === "ASC" ? "NULLS FIRST" : "NULLS LAST";
    const idOrder = this.idOrder;
    const [name, path] = this.structPath(column);
    const idOf = this.rowIdOf(column);

    const isWholeDevice = idOrder !== undefined && idOf === "device" && path === undefined;
    if (isWholeDevice) {
      const place = `indexOf(${ORDER_IDS}, tupleElement(${target}, 1)) ${direction} ${nulls}`;
      return `${place}, tupleElement(${target}, 2) ${direction} ${nulls}`;
    }
    const isContributorName = idOrder !== undefined && idOf === "contributor" && path === "name";
    if (isContributorName) {
      return `indexOf(${ORDER_IDS}, ${this.quoteName(name)}) ${direction} ${nulls}`;
    }
    const type = output === undefined ? this.rowTypes.get(column) : this.outputTypeOf?.(output);
    return this.nanApart(target, type, `${direction} ${nulls}`);
  }

  /** The type each output of a statement over these rows takes, which its sort depends on. */
  typesOutputs(typeOf: (output: NamedOutput) => string | undefined): this {
    this.outputTypeOf = typeOf;
    return this;
  }

  /** Spark sorts NaN above every number; the store would put it beside the nulls. */
  private nanApart(target: string, type: string | undefined, order: string): string {
    return type === "DOUBLE"
      ? `isNaN(${target}) ${order}, ${target} ${order}`
      : `${target} ${order}`;
  }

  buildOver(statement: string): string {
    return this.joinClauses([this.withClause(), statement]);
  }

  /**
   * The rows as values a statement over them computes with, every filter applied: numbers as
   * numbers, a payload field from its JSON, a contributor as its id, and a device as the key the
   * warehouse groups its struct by.
   */
  buildValues(): string {
    const projection = this.outputColumns()
      .map((column) => `${this.valueOf(column)} AS ${this.quoteName(column.name)}`)
      .join(", ");
    const where =
      this.whereConditions.length > 0 ? `WHERE ${this.whereConditions.join(" AND ")}` : "";
    const first = this.firstRows;
    if (first === undefined) {
      return this.joinClauses([
        this.withClause(),
        `SELECT ${projection}`,
        `FROM ${this.fromClause}`,
        where,
      ]);
    }

    const key = this.key.join(", ");
    const order = first.order
      .map(({ column, nulls }) => `${this.projectedExpression(column)} ASC NULLS ${nulls}`)
      .join(", ");
    const firstKeys = this.joinClauses([
      `SELECT ${key}`,
      `FROM ${this.fromClause}`,
      where,
      first.withTies ? `ORDER BY ${order}` : `ORDER BY ${order}, ${key}`,
      first.withTies ? `LIMIT ${first.count} WITH TIES` : `LIMIT ${first.count}`,
    ]);
    const conditions = [...this.whereConditions, `(${key}) IN (${firstKeys})`];
    return this.joinClauses([
      this.withClause(),
      `SELECT ${projection}`,
      `FROM ${this.fromClause}`,
      `WHERE ${conditions.join(" AND ")}`,
    ]);
  }

  /**
   * These rows as an as-of read's second table: per key and time the one with the lowest id, as
   * the warehouse breaks a tie. A device and an array come as JSON text, since no match nulls them.
   */
  buildAsOfSecondary(match: {
    column: string;
    time: string;
    columns: { name: string; alias: string }[];
  }): StoreAsOfSecondary {
    const key = this.columnExpression(match.column);
    const at = this.instantOf(this.columnExpression(match.time));
    const values = match.columns.map(({ name, alias }) => {
      const { type, idOf } = this.outputColumn(name);
      return { name, column: { name: alias, type, idOf } };
    });
    const projection = [
      `${key} AS ${ASOF_KEY}`,
      `${at} AS ${ASOF_TIME}`,
      `1 AS ${ASOF_FOUND}`,
      ...values.flatMap(({ name, column }) => this.secondaryValuesOf(name, column)),
    ];
    const where = [...this.whereConditions, `${key} IS NOT NULL`, `${at} IS NOT NULL`];
    const sql = this.joinClauses([
      this.withClause(),
      `SELECT ${projection.join(", ")}`,
      `FROM ${this.fromClause}`,
      `WHERE ${where.join(" AND ")}`,
      `ORDER BY ${ASOF_KEY}, ${ASOF_TIME}, ${this.columnExpression("id")} ASC`,
      `LIMIT 1 BY ${ASOF_KEY}, ${ASOF_TIME}`,
    ]);
    return {
      sql,
      columns: values.map(({ column }) => column),
      readsTable: this.finalTable !== undefined,
    };
  }

  /**
   * Adds another table's columns, each from its latest row with the same key at or before this
   * row's time, and null where there is none or it is older than the tolerance.
   */
  joinAsOf(
    secondary: StoreAsOfSecondary,
    match: { column: string; time: string; toleranceMinutes: number },
  ): this {
    const key = this.columnExpression(match.column);
    const at = this.instantOf(this.columnExpression(match.time));
    const isRecent = `${ASOF_SECONDARY}.${ASOF_FOUND} = 1 AND ${ASOF_SECONDARY}.${ASOF_TIME} >= ${at} - INTERVAL ${match.toleranceMinutes} MINUTE`;
    const on = `${key} = ${ASOF_SECONDARY}.${ASOF_KEY} AND ${at} >= ${ASOF_SECONDARY}.${ASOF_TIME}`;
    const primary =
      this.finalTable === undefined
        ? `${this.fromClause} AS ${ASOF_PRIMARY}`
        : `${this.finalTable} AS ${ASOF_PRIMARY} FINAL`;
    this.fromClause = `${primary} ASOF LEFT JOIN (${secondary.sql}) AS ${ASOF_SECONDARY} ON ${on}`;
    this.joinsTable = secondary.readsTable;
    this.columns = [
      ...this.columns,
      ...secondary.columns.map(({ name, type, idOf }) => {
        const matched = (sql: string) => `if(${isRecent}, ${ASOF_SECONDARY}.${sql}, NULL)`;
        if (idOf !== "device") {
          return { name, type, idOf, expression: matched(this.quoteName(name)) };
        }
        const device = {
          clientId: matched(this.quoteName(name)),
          label: matched(this.quoteName(this.matchedLabelName(name))),
        };
        return {
          name,
          type,
          idOf,
          isPairText: true,
          expression: `if(${isRecent}, toJSONString(tuple(${device.clientId}, ${device.label})), NULL)`,
          matchedDevice: device,
        };
      }),
    ];
    return this;
  }

  private secondaryValuesOf(name: string, column: StoreOutputColumn): string[] {
    const expression = this.projectedExpression(name);
    const quoted = this.quoteName(column.name);
    if (column.idOf === "device") {
      const { label } = this.devicePartsOf(this.baseColumn(name));
      return [
        `${expression} AS ${quoted}`,
        `${label} AS ${this.quoteName(this.matchedLabelName(column.name))}`,
      ];
    }
    const isField = this.fieldExpressions().has(name);
    const isNested = column.type.startsWith("ARRAY<") || column.type.startsWith("STRUCT<");
    const isArray = isNested && !isField && column.idOf === undefined;
    return [`${isArray ? `toJSONString(${expression})` : expression} AS ${quoted}`];
  }

  private matchedLabelName(name: string): string {
    return `${ASOF_LABEL}${name}`;
  }

  private valueOf({ name, idOf }: StoreOutputColumn): string {
    const expression = this.projectedExpression(name);
    if (idOf !== "device") {
      return expression;
    }
    const [base] = this.structPath(name);
    return this.deviceKeyOf(this.devicePartsOf(this.baseColumn(base)));
  }

  /**
   * The warehouse groups a device by its struct: a registered one by the registry's row, which its
   * client id names, and any other by its label alone, however many clients share it.
   */
  private deviceKeyOf({ clientId, label }: DeviceParts): string {
    const registered =
      this.deviceSerials.length > 0
        ? `if(${clientId} IN ${DEVICE_CLIENT_IDS}, ${clientId}, NULL)`
        : "CAST(NULL AS Nullable(String))";
    return `tuple(${registered}, ${label})`;
  }

  /** A device's client id and label: a matched table's from its own names, any other's from its
   *  row's. */
  private devicePartsOf(column: StoreColumn): DeviceParts {
    return (
      column.matchedDevice ?? {
        clientId: column.expression,
        label: this.deviceLabelOf(column.expression),
      }
    );
  }

  private rowIdOf(column: string): "contributor" | "device" | undefined {
    const [name, path] = this.structPath(column);
    const isOwnName = path !== undefined && this.rowNames.has(column);
    return isOwnName ? undefined : this.rowIds.get(name);
  }

  /** Spark reads a date as midnight in its session's zone, UTC. */
  private instantOf(sql: string): string {
    return `toDateTime64(${sql}, 6, 'UTC')`;
  }

  private orderColumnOf(item: AggregateExpression): string {
    if (!item.orderColumn?.trim()) {
      throw new QueryBuilderInputError(ORDER_COLUMN_REQUIRED_MESSAGE);
    }
    return item.orderColumn;
  }

  outputColumns(): StoreOutputColumn[] {
    if (this.selectColumns !== undefined) {
      return this.selectColumns.map((name) => this.outputColumn(name));
    }

    const hidden = new Set([
      ...this.variantColumns.map(({ column }) => column),
      ...this.exceptColumns,
    ]);
    const base = this.columns
      .filter(({ name }) => !hidden.has(name))
      .map(({ name, type, idOf, isPairText }) => ({ name, type, idOf, isPairText }));
    const flattened = [...this.flattenedFields().values()];
    const fields = this.variantColumns.flatMap((variant) =>
      VariantSchema.isObject(variant.schema)
        ? flattened
            .filter(({ column }) => column === variant.column)
            .map(({ key, field }) => ({
              name: key,
              type: this.variantCastType(field.type),
              ...this.textSource(variant.column, field.name),
            }))
        : [
            {
              name: variant.column,
              type: this.variantCastType(variant.schema),
              ...this.textSource(variant.column),
            },
          ],
    );
    return [...base, ...fields];
  }

  build(): string {
    if (!this.fromClause) {
      throw new Error("FROM clause is required");
    }

    const selectKeyword = this.isDistinct ? "SELECT DISTINCT" : "SELECT";
    const projection = this.projection();
    const where =
      this.whereConditions.length > 0 ? `WHERE ${this.whereConditions.join(" AND ")}` : "";
    const order = this.ordering === undefined ? "" : `ORDER BY ${this.sortClause(this.ordering)}`;
    const limitClause = this.limitValue === undefined ? "" : `LIMIT ${this.limitValue}`;
    const offsetClause = this.offsetValue === undefined ? "" : `OFFSET ${this.offsetValue}`;

    const sortColumns = this.ordering === undefined ? [] : [this.ordering.column];
    const isMetadataFilteredOrSorted = this.readsMetadata([...this.filterColumns, ...sortColumns]);
    const isMetadataShown = this.readsMetadata(this.outputColumns().map(({ name }) => name));
    const isMetadataRead = isMetadataFilteredOrSorted || isMetadataShown;

    // Through FINAL, the store reads every column of every matching row before it applies LIMIT.
    // A sorted page therefore finds its rows' keys first, reading only the key columns, and then
    // reads just those rows. A key names one row, so the outer statement needs no LIMIT.
    const isSortedPage =
      this.ordering !== undefined && this.limitValue !== undefined && !this.isDistinct;
    if (isSortedPage) {
      const key = this.key.join(", ");
      // Rows with equal sort values come in no fixed order, so a row on a page boundary could land
      // on two pages or on none. The key, unique per row, fixes the order.
      const page = this.joinClauses([
        `SELECT ${key}`,
        `FROM ${isMetadataFilteredOrSorted ? this.withMetadata("") : this.fromClause}`,
        where,
        `${order}, ${key}`,
        limitClause,
        offsetClause,
      ]);
      const pageRows = `WHERE (${key}) IN (${page})`;
      return this.joinClauses(
        isMetadataRead
          ? [
              this.withClause(),
              `SELECT ${projection}`,
              `FROM ${this.withMetadata(pageRows)}`,
              order,
            ]
          : [this.withClause(), `SELECT ${projection}`, `FROM ${this.fromClause}`, pageRows, order],
      );
    }

    return this.joinClauses([
      this.withClause(),
      `${selectKeyword} ${projection}`,
      `FROM ${isMetadataRead ? this.withMetadata("") : this.fromClause}`,
      where,
      order,
      limitClause,
      offsetClause,
    ]);
  }

  /** Each column under its name; of the columns read from one payload's text, the first carries
   *  the text and the rest carry nothing, so a row holds each text once. */
  private projection(): string {
    const carried = new Set<string>();
    return this.outputColumns()
      .map((column) => {
        const text = column.text?.column;
        if (text === undefined) {
          return `${this.projectedValue(column)} AS ${this.quoteName(column.name)}`;
        }
        const carries = !carried.has(text);
        carried.add(text);
        return `${carries ? text : "NULL"} AS ${this.quoteName(column.name)}`;
      })
      .join(", ");
  }

  private readsMetadata(names: string[]): boolean {
    if (!this.takesCustomMetadata) {
      return false;
    }
    const fields = new Set(
      [...this.flattenedFields().values()]
        .filter(({ column }) => column === CUSTOM_METADATA)
        .map(({ key }) => key),
    );
    return names.some((name) => fields.has(name));
  }

  /**
   * The view's rows with the fields of the row each sheet matches, one LEFT JOIN per sheet. The
   * joins see only the rows `rowFilter` keeps, written on the left side rather than left to the
   * store to push down.
   */
  private withMetadata(rowFilter: string): string {
    const sheets = this.matchedSheets();
    const joins = sheets.map(
      ({ id, match, alias }) =>
        `LEFT JOIN (SELECT identifier, fields FROM experiment_metadata_rows(experiment = ${this.experiment}) WHERE sheet_id = ${this.escapeValue(id)}) AS ${alias} ON ${alias}.identifier = ${match}`,
    );
    const fields = sheets.map(({ alias }) => `${alias}.fields AS ${alias}_fields`);

    const rows = this.joinClauses([`SELECT * FROM ${this.fromClause}`, rowFilter]);
    const joined = this.joinClauses([
      `SELECT ${["base.*", ...fields].join(", ")}`,
      `FROM (${rows}) AS base`,
      ...joins,
    ]);
    return `(${joined})`;
  }

  /** The sheets, oldest first, that match a question's answer or the device; a sheet matching any
   *  other column matches no row. */
  private matchedSheets(): {
    id: string;
    match: string;
    alias: string;
    fields: ReadonlySet<string>;
    nestsObjects: boolean;
  }[] {
    return this.sheets.flatMap(({ id, matchOn, fields, nestsObjects }, index) => {
      const match = this.sheetMatch(matchOn);
      return match === null ? [] : [{ id, match, alias: `sheet_${index}`, fields, nestsObjects }];
    });
  }

  private sheetMatch(matchOn: string): string | null {
    if (matchOn === "column:device_id") {
      return "base.device_id";
    }
    return matchOn.startsWith("column:")
      ? null
      : `base.questions_data[${this.escapeValue(matchOn)}]`;
  }

  /**
   * A field's JSON text in the newest sheet whose matched row holds it, null ones included. It is
   * copied as written, since a parsed number passes through a double, which loses digits a sheet's
   * decimals keep. simpleJSON copies it so, and reads a row holding an integer past 64 bits, which
   * JSONHas cannot parse; but it finds a key at any depth. Only a row's top-level keys count, as
   * the warehouse reads a sheet's fields, so a sheet whose rows can hold objects, as an object or a
   * mix of kinds in its schema says, is read with JSONHas and JSONExtractRaw. A sheet whose schema
   * lacks the field is not asked, so a page of many wide sheets stays within the store's query
   * size.
   */
  private metadataText(name: string): string {
    const key = this.escapeValue(name);
    const newestFirst = this.matchedSheets()
      .filter(({ fields }) => fields.has(name))
      .reverse();
    const branches = newestFirst.flatMap(({ alias, nestsObjects }) => {
      const json = nestsObjects ? "JSON" : "simpleJSON";
      return [`${json}Has(${alias}_fields, ${key})`, `${json}ExtractRaw(${alias}_fields, ${key})`];
    });
    return branches.length === 0
      ? "CAST(NULL AS Nullable(String))"
      : `multiIf(${branches.join(", ")}, NULL)`;
  }

  private outputColumn(name: string): StoreOutputColumn {
    const field = this.flattenedFields().get(name);
    if (field !== undefined) {
      return {
        name,
        type: this.variantCastType(field.field.type),
        ...this.textSource(field.column, field.field.name),
      };
    }
    const whole = this.variantColumns.find(
      ({ column, schema }) => column === name && !VariantSchema.isObject(schema),
    );
    if (whole !== undefined) {
      return {
        name,
        type: this.variantCastType(whole.schema),
        ...this.textSource(whole.column),
      };
    }
    const [base, path] = this.structPath(name);
    if (path !== undefined) {
      return { name, type: this.typeOf(name) };
    }
    const { type, idOf, isPairText } = this.baseColumn(base);
    return { name, type, idOf, isPairText };
  }

  /**
   * Integers come back as text, since ids pass 2^53, and decimals as text at their scale, as Spark
   * writes 1.5 at scale 2 as 1.50. A device comes back as its client id and the label its row's own
   * names give, which the backend finishes with the registry's serial number.
   */
  private projectedValue({ name, type, idOf, isPairText }: StoreOutputColumn): string {
    const expression = this.projectedExpression(name);
    const isClientId = idOf === "device" && !isPairText;
    if (isClientId) {
      const { clientId, label } = this.devicePartsOf(this.baseColumn(this.structPath(name)[0]));
      return `tuple(${clientId}, ${label})`;
    }
    if (this.isIntegerType(type)) {
      return `toString(${expression})`;
    }
    const decimal = VariantSchema.decimalOf(type);
    return decimal === null ? expression : `toDecimalString(${expression}, ${decimal.scale})`;
  }

  private projectedExpression(name: string): string {
    const field = this.fieldExpressions().get(name);
    if (field !== undefined) {
      return field;
    }
    const whole = this.variantColumns.find(
      ({ column, schema }) => column === name && !VariantSchema.isObject(schema),
    );
    return whole === undefined ? this.columnExpression(name) : this.wholeColumn(whole);
  }

  /** Spark sorts nulls first going up and last going down; the store puts them last both ways. */
  private sortClause({ column, direction = "ASC", mode }: QueryOrdering): string {
    const idOrder = this.idOrder;
    const nulls = direction === "ASC" ? "NULLS FIRST" : "NULLS LAST";
    if (idOrder !== undefined) {
      const [name] = this.structPath(column);
      const base = this.baseColumn(name);
      if (base.idOf !== "device") {
        return `indexOf(${ORDER_IDS}, ${base.expression}) ${direction} ${nulls}`;
      }
      // A whole device sorts as Spark sorts its struct: by the registry's id, which only the ids
      // in the order carry, then by its label.
      const { clientId, label } = this.devicePartsOf(base);
      return `indexOf(${ORDER_IDS}, ${clientId}) ${direction} ${nulls}, ${label} ${direction} ${nulls}`;
    }

    const target = this.columnExpression(column);
    const isRowOrdered = mode?.kind === "numericString" || mode?.kind === "number";
    const rowId =
      isRowOrdered && !this.isDistinct && mode.rowId
        ? this.columnExpression(mode.rowId)
        : undefined;
    if (mode?.kind === "numericString") {
      return numericStringOrdering(this.numericStringKeys(target, rowId), direction);
    }
    if (mode?.kind === "number") {
      const sorted = this.nanApart(target, this.outputColumn(column).type, `${direction} NULLS LAST`);
      return `${sorted}${rowId ? `, ${rowId} ASC` : ""}`;
    }
    if (mode?.kind === "pseudonym") {
      return `${this.contributorPseudonym(target, mode.salt)} ${direction} ${nulls}`;
    }
    return this.nanApart(target, this.outputColumn(column).type, `${direction} ${nulls}`);
  }

  /** The warehouse's keys for text that holds a number, in the store's functions. */
  private numericStringKeys(value: string, rowId?: string): NumericStringKeys {
    const trimmed = `trim(BOTH concat(char(9), char(10), char(11), char(12), char(13), ' ') FROM ${value})`;
    const representable = `match(${trimmed}, '^[+-]?(?:0*[0-9]{1,20}(?:[.][0-9]{0,18}0*)?|[.][0-9]{1,18}0*)$')`;
    const decimal = `CASE WHEN ${representable} THEN toDecimal128OrNull(${trimmed}, 18) END`;
    const group = `CASE WHEN (${decimal}) IS NOT NULL THEN 0 WHEN ${trimmed} IS NULL OR ${trimmed} = '' THEN 2 ELSE 1 END`;
    return { group, decimal, value, rowId };
  }

  /**
   * The label the warehouse shows for a device, from the serial numbers the store is handed. A
   * read handed none labels devices by their rows' names alone.
   */
  private deviceLabelOf(clientIdSql: string): string {
    const hasSerials = this.deviceSerials.length > 0;
    return deviceLabel({
      serialNumber: hasSerials
        ? this.serialNumberOf(clientIdSql)
        : "CAST(NULL AS Nullable(String))",
      deviceName: this.baseColumn("device_name").expression,
      deviceId: this.baseColumn("device_id").expression,
      clientId: clientIdSql,
    });
  }

  /** A hash lookup per row, where a scan of the list per row costs as much as the rest of a read. */
  private serialNumberOf(clientIdSql: string): string {
    return `transform(${clientIdSql}, ${DEVICE_CLIENT_IDS}, ${DEVICE_SERIALS}, CAST(NULL AS Nullable(String)))`;
  }

  /**
   * The id lists a statement reads, each written once under a name: a sorted page reads them in
   * its inner and outer statements, and a label reads its serial twice.
   */
  private withClause(): string {
    const quoted = (values: string[]) => values.map((value) => this.escapeValue(value)).join(", ");
    const idOrder = this.idOrder;
    const lists = [
      ...(idOrder === undefined ? [] : [`[${quoted(idOrder)}] AS ${ORDER_IDS}`]),
      ...(this.deviceSerials.length === 0
        ? []
        : [
            `[${quoted(this.deviceSerials.map(([clientId]) => clientId))}] AS ${DEVICE_CLIENT_IDS}`,
            `CAST([${this.deviceSerials.map(([, serial]) => (serial === null ? "NULL" : this.escapeValue(serial))).join(", ")}] AS Array(Nullable(String))) AS ${DEVICE_SERIALS}`,
          ]),
      ...(this.flaggedRowIds === undefined
        ? []
        : [`CAST([${quoted(this.flaggedRowIds)}] AS Array(String)) AS ${FLAGGED_ROW_IDS}`]),
    ];
    return lists.length === 0 ? "" : `WITH ${lists.join(", ")}`;
  }

  private structPath(column: string): [string, string | undefined] {
    const dot = column.indexOf(".");
    return dot === -1 ? [column, undefined] : [column.slice(0, dot), column.slice(dot + 1)];
  }

  private baseColumn(name: string): StoreColumn {
    const column = this.columns.find((candidate) => candidate.name === name);
    if (column === undefined) {
      throw new QueryBuilderInputError(`Unknown column '${name}'`);
    }
    return column;
  }

  /** The warehouse type of a column a filter names. A struct's fields here are all text. */
  private typeOf(column: string): string {
    const field = this.flattenedFields().get(column);
    if (field !== undefined) {
      return this.variantCastType(field.field.type);
    }
    const [name, path] = this.structPath(column);
    return path === undefined ? this.baseColumn(name).type : "STRING";
  }

  private fieldExpressions(): ReadonlyMap<string, string> {
    this.expressions ??= new Map(
      [...this.flattenedFields().values()].map(({ key, column, field }) => [
        key,
        this.fieldExpression(column, field),
      ]),
    );
    return this.expressions;
  }

  /** Each field by the name it reads as, which no two fields share. */
  private flattenedFields(): ReadonlyMap<string, FlattenedField> {
    this.fields ??= new Map(
      FlattenedFields.resolve(this.reservedColumns, this.variantColumns).map((field) => [
        field.key,
        field,
      ]),
    );
    return this.fields;
  }

  private forgetFields(): void {
    this.fields = undefined;
    this.expressions = undefined;
  }

  /**
   * A scalar reads as its type and is null when the value holds another, as `try_variant_get`
   * reads it. Anything else reads as JSON, which the adapter writes out as the warehouse does.
   * Answers are a map of text, so every answer reads by key, a Number question's as Spark casts
   * its text.
   */
  private fieldExpression(column: string, field: VariantField): string {
    const type = this.variantCastType(field.type);
    if (column === "questions_data") {
      const answer = `${column}[${this.escapeValue(field.name)}]`;
      if (type === "DOUBLE") {
        return this.textAsDouble(answer);
      }
      return type === "STRING" ? answer : this.typedScalar(answer, type);
    }
    if (column === CUSTOM_METADATA) {
      return this.metadataValue(this.metadataText(field.name), type);
    }

    // Quoted, the payload column would read as a table name before its subcolumn.
    const path = `${column}.${this.subcolumn(field.name)}`;
    const object = `${column}.^${this.subcolumn(field.name)}`;
    return this.typedValue(path, object, type);
  }

  /**
   * A page shows a JSON payload's cells from its text, since the JSON column reprints numbers and
   * keeps no null key; filters and sorts read the JSON column. A distinct read keeps to the JSON
   * column too, as distinct texts are not distinct values.
   */
  private textSource(column: string, key?: string): Pick<StoreOutputColumn, "text"> {
    const text = this.payloadTexts[column];
    const readsText = text !== undefined && !this.isDistinct && !this.plotsValues;
    return readsText ? { text: { column: text, key } } : {};
  }

  /** The feed stores a payload that is no object as `{"_items": [...]}` or `{"_value": x}`. */
  private wholeColumn({ column: source, schema }: FlattenedSource): string {
    const type = this.variantCastType(schema);
    if (type.startsWith("ARRAY<")) {
      return `toJSONString(${source}._items)`;
    }
    if (type === "VARIANT") {
      return [
        `multiIf(dynamicType(${source}._items) != 'None', toJSONString(${source}._items)`,
        `dynamicType(${source}._value) != 'None', toJSONString(${source}._value)`,
        `toJSONString(${source}))`,
      ].join(", ");
    }
    return this.typedValue(`${source}._value`, `${source}.^_value`, type);
  }

  /** An object that holds no paths was null or empty, and reads as null. */
  private typedValue(path: string, object: string, type: string): string {
    const objectJson = `if(length(JSONAllPaths(assumeNotNull(${object}))) = 0, NULL, toJSONString(${object}))`;
    if (type.startsWith("STRUCT<")) {
      return objectJson;
    }
    if (type.startsWith("ARRAY<")) {
      return `toJSONString(${path})`;
    }
    if (type === "VARIANT") {
      return `if(dynamicType(${path}) != 'None', toJSONString(${path}), ${objectJson})`;
    }
    return this.typedScalar(path, type);
  }

  /**
   * Text as Spark casts it to a double, through Java's parser: blanks and control characters
   * trimmed, a trailing d or f read, and null for text that holds no number.
   */
  private textAsDouble(textSql: string): string {
    const trimmed = `replaceRegexpAll(${textSql}, ${this.escapeValue("^[\\x00-\\x20]+|[\\x00-\\x20]+$")}, '')`;
    const number = "^([+-]?(?:[0-9]+[.]?[0-9]*|[.][0-9]+)(?:[eE][+-]?[0-9]+)?)[dDfF]$";
    const unsuffixed = `replaceRegexpOne(${trimmed}, ${this.escapeValue(number)}, ${this.escapeValue("\\1")})`;
    return `toFloat64OrNull(${unsuffixed})`;
  }

  /** A sheet value's JSON text typed as an answer's text is, a decimal at the schema's scale; an
   *  object, an array or a mix of kinds shows as its JSON. A mix keeps an explicit null as `null`,
   *  as `try_variant_get` shows it, where a typed value reads it as none. */
  private metadataValue(text: string, type: string): string {
    const decimal = VariantSchema.decimalOf(type);
    if (decimal !== null) {
      const storeType = `Decimal(${decimal.precision}, ${decimal.scale})`;
      return `accurateCastOrNull(${text}, ${this.escapeValue(storeType)})`;
    }
    if (type === "DOUBLE") {
      return this.textAsDouble(text);
    }
    if (type === "STRING") {
      return `JSONExtract(${text}, 'Nullable(String)')`;
    }
    if (type === "VARIANT") {
      return text;
    }
    const isScalar = type in STORE_SCALARS;
    return isScalar ? this.typedScalar(text, type) : `nullIf(${text}, 'null')`;
  }

  private typedScalar(sql: string, type: string): string {
    const storeType = STORE_SCALARS[type] ?? "String";
    return `accurateCastOrNull(${sql}, ${this.escapeValue(storeType)})`;
  }

  /** The store keeps a dot in a key as %2E, so "Plot no." stays one key. */
  private subcolumn(name: string): string {
    return this.quoteName(name.replaceAll(".", "%2E"));
  }

  /** The store reads backslash escapes inside a quoted name, where Spark reads none. */
  quoteName(name: string): string {
    return `\`${name.replaceAll("\\", "\\\\").replaceAll("`", "\\`")}\``;
  }
}
