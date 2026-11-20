import type { ExperimentDataFlagged } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { isNumericType } from "@repo/api/transforms/column-type-utils";

import type { StoreMetadataSheet } from "../../../../../experiments/core/ports/serving-store.port";
import { deviceLabel } from "../../../databricks/services/query-builder/expressions/device-label";
import { numericStringOrdering } from "../../../databricks/services/query-builder/expressions/numeric-string-order";
import type { NumericStringKeys } from "../../../databricks/services/query-builder/expressions/numeric-string-order";
import { BaseQueryBuilder } from "../../../databricks/services/query-builder/query-builder.base";
import type {
  FilterCondition,
  FilterValue,
  QueryOrdering,
} from "../../../databricks/services/query-builder/query-builder.types";
import { QueryBuilderInputError } from "../../../databricks/services/query-builder/query-builder.types";
import { FlattenedFields } from "../../../databricks/services/query-builder/schema/flattened-fields";
import type {
  FlattenedField,
  FlattenedSource,
} from "../../../databricks/services/query-builder/schema/flattened-fields";
import { VariantSchema } from "../../../databricks/services/query-builder/schema/variant-schema";
import type { VariantField } from "../../../databricks/services/query-builder/schema/variant-schema";
import type { StoreColumn, StoreTable } from "./store-tables";

export type StoreOutputColumn = Pick<StoreColumn, "name" | "type" | "idOf"> & {
  text?: { column: string; key?: string };
};

interface StoreOrdering extends QueryOrdering {
  idOrder?: string[];
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
  private deviceSerials: [string, string][] = [];
  private flaggedRowIds?: string[];
  private sheets: (StoreMetadataSheet & {
    fields: ReadonlySet<string>;
    nestsObjects: boolean;
  })[] = [];
  private ordering?: StoreOrdering;
  private limitValue?: number;
  private offsetValue?: number;
  /** Kept until a payload, a reserved name or a sheet changes them. */
  private fields?: Map<string, FlattenedField>;
  private expressions?: Map<string, string>;

  read(table: StoreTable, experimentId: string, identifier?: string): this {
    this.experiment = this.escapeValue(experimentId);
    this.columns = table.columns;
    this.key = table.key;
    this.payloadTexts = table.payloadTexts ?? {};
    this.phoneAnnotations = table.phoneAnnotations;
    this.takesCustomMetadata = table.takesCustomMetadata ?? false;
    this.reservedColumns.push(...StoreQueryBuilder.reservedNames);
    this.forgetFields();
    this.from(`${table.view}(experiment = ${this.experiment})`);
    if (table.identifierColumn !== undefined && identifier !== undefined) {
      this.where(`${table.identifierColumn} = ${this.escapeValue(identifier)}`);
    }
    return this;
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

  /** The registered devices' serial numbers by client id; any other device reads none. */
  serialNumbers(serials: [string, string][]): this {
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
    this.ordering = { ...ordering, idOrder };
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
      return this.deviceLabelOf(base.expression);
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
    const isInteger = type === "BIGINT" || type === "INT";
    return isInteger ? /^-?\d+$/.test(text) : /^-?\d+(\.\d+)?$/.test(text);
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
      .map(({ name, type, idOf }) => ({ name, type, idOf }));
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
    const { type, idOf } = this.baseColumn(base);
    return { name, type, idOf };
  }

  /**
   * Integers come back as text, since ids pass 2^53, and decimals as text at their scale, as Spark
   * writes 1.5 at scale 2 as 1.50. A device comes back as its client id and the label its row's own
   * names give, which the backend finishes with the registry's serial number.
   */
  private projectedValue({ name, type, idOf }: StoreOutputColumn): string {
    const expression = this.projectedExpression(name);
    if (idOf === "device") {
      return `tuple(${expression}, ${this.deviceLabelOf(expression)})`;
    }
    const isInteger = type === "BIGINT" || type === "INT";
    if (isInteger) {
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
  private sortClause({ column, direction = "ASC", mode, idOrder }: StoreOrdering): string {
    const nulls = direction === "ASC" ? "NULLS FIRST" : "NULLS LAST";
    if (idOrder !== undefined) {
      const [name] = this.structPath(column);
      const { expression, idOf } = this.baseColumn(name);
      const place = `indexOf(${ORDER_IDS}, ${expression}) ${direction} ${nulls}`;
      // A whole device sorts as Spark sorts its struct: by the registry's id, which only the ids
      // in the order carry, then by its label.
      const isDevice = idOf === "device";
      return isDevice ? `${place}, ${this.deviceLabelOf(expression)} ${direction} ${nulls}` : place;
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
      const nan = this.nanKey(target, column, direction, "NULLS LAST");
      return `${nan}${target} ${direction} NULLS LAST${rowId ? `, ${rowId} ASC` : ""}`;
    }
    const sorted =
      mode?.kind === "pseudonym" ? this.contributorPseudonym(target, mode.salt) : target;
    return `${this.nanKey(sorted, column, direction, nulls)}${sorted} ${direction} ${nulls}`;
  }

  /** Spark sorts NaN above every number, where the store sorts it beside null. */
  private nanKey(sorted: string, column: string, direction: string, nulls: string): string {
    const isDouble = this.typeOf(column) === "DOUBLE";
    return isDouble ? `isNaN(${sorted}) ${direction} ${nulls}, ` : "";
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

  /** A client id missing from the list reads 0 from indexOf, and the Nullable array's NULL there. */
  private serialNumberOf(clientIdSql: string): string {
    return `arrayElement(${DEVICE_SERIALS}, indexOf(${DEVICE_CLIENT_IDS}, ${clientIdSql}))`;
  }

  /**
   * The id lists a statement reads, each written once under a name: a sorted page reads them in
   * its inner and outer statements, and a label reads its serial twice.
   */
  private withClause(): string {
    const quoted = (values: string[]) => values.map((value) => this.escapeValue(value)).join(", ");
    const idOrder = this.ordering?.idOrder;
    const lists = [
      ...(idOrder === undefined ? [] : [`[${quoted(idOrder)}] AS ${ORDER_IDS}`]),
      ...(this.deviceSerials.length === 0
        ? []
        : [
            `[${quoted(this.deviceSerials.map(([clientId]) => clientId))}] AS ${DEVICE_CLIENT_IDS}`,
            `CAST([${quoted(this.deviceSerials.map(([, serial]) => serial))}] AS Array(Nullable(String))) AS ${DEVICE_SERIALS}`,
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
    return text === undefined || this.isDistinct ? {} : { text: { column: text, key } };
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
