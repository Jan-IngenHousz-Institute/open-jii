import { isNumericType } from "@repo/api/transforms/column-type-utils";

import { numericStringOrdering } from "../../../databricks/services/query-builder/expressions/numeric-string-order";
import type { NumericStringKeys } from "../../../databricks/services/query-builder/expressions/numeric-string-order";
import { BaseQueryBuilder } from "../../../databricks/services/query-builder/query-builder.base";
import type {
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

export type StoreOutputColumn = Pick<StoreColumn, "name" | "type" | "idOf">;

interface StoreOrdering extends QueryOrdering {
  idOrder?: string[];
}

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
  private fromClause = "";
  private columns: StoreColumn[] = [];
  private key: string[] = [];
  private selectColumns?: string[];
  private variantColumns: FlattenedSource[] = [];
  private reservedColumns: string[] = [];
  private exceptColumns: string[] = [];
  private whereConditions: string[] = [];
  private deviceSerials: [string, string | null][] = [];
  private ordering?: StoreOrdering;
  private limitValue?: number;
  private offsetValue?: number;

  read(table: StoreTable, experimentId: string, identifier?: string): this {
    this.columns = table.columns;
    this.key = table.key;
    this.from(`${table.view}(experiment = ${this.escapeValue(experimentId)})`);
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
    return this;
  }

  reserve(columns: string[]): this {
    this.reservedColumns.push(...columns);
    return this;
  }

  except(columns: string[]): this {
    this.exceptColumns.push(...columns);
    return this;
  }

  serialNumbers(serials: [string, string | null][]): this {
    this.deviceSerials = serials;
    return this;
  }

  where(condition: string): this {
    this.whereConditions.push(condition);
    return this;
  }

  /**
   * `idOrder` sorts a contributor's field the store does not hold, such as the name, by the place
   * of each row's contributor in it; names never enter a query, whose text the store logs.
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
      return this.serialNumberOf(base.expression);
    }
    throw new QueryBuilderInputError(`The store cannot read '${column}'`);
  }

  /** A literal of the column's own type: the store compares no text with a number, and reads a
   *  time only in its own format. */
  filterLiteral(column: string, value: Exclude<FilterValue, (string | number)[]>): string {
    const type = this.typeOf(column);
    const isTime = type === "TIMESTAMP" || type === "DATE";
    if (isTime && typeof value !== "string") {
      throw new QueryBuilderInputError(`'${column}' is compared with a time given as text`);
    }
    const isNumber = isNumericType(type);
    if (isNumber && typeof value === "string" && !this.readsAsNumber(value, type)) {
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
    return this.escapeScalarValue(value);
  }

  /** The store reads text as a number column's value only as plain digits, with a fraction where
   *  the type holds one. */
  private readsAsNumber(text: string, type: string): boolean {
    const isInteger = type === "BIGINT" || type === "INT";
    return isInteger ? /^-?\d+$/.test(text) : /^-?\d+(\.\d+)?$/.test(text);
  }

  textOf(columnSql: string): string {
    return `toString(${columnSql})`;
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
    const flattened = this.flattenedFields();
    const fields = this.variantColumns.flatMap((variant) =>
      VariantSchema.isObject(variant.schema)
        ? flattened
            .filter(({ column }) => column === variant.column)
            .map(({ key, field }) => ({ name: key, type: this.variantCastType(field.type) }))
        : [{ name: variant.column, type: this.variantCastType(variant.schema) }],
    );
    return [...base, ...fields];
  }

  build(): string {
    if (!this.fromClause) {
      throw new Error("FROM clause is required");
    }

    const selectKeyword = this.isDistinct ? "SELECT DISTINCT" : "SELECT";
    const projection = this.outputColumns()
      .map(({ name, type }) => `${this.projectedValue(name, type)} AS ${this.quoteName(name)}`)
      .join(", ");
    const where =
      this.whereConditions.length > 0 ? `WHERE ${this.whereConditions.join(" AND ")}` : "";
    const order = this.ordering === undefined ? "" : `ORDER BY ${this.sortClause(this.ordering)}`;
    const limitClause = this.limitValue === undefined ? "" : `LIMIT ${this.limitValue}`;
    const offsetClause = this.offsetValue === undefined ? "" : `OFFSET ${this.offsetValue}`;

    // Through FINAL, the store reads every column of every matching row before it applies LIMIT.
    // A sorted page therefore finds its rows' keys first, reading only the key columns, and then
    // reads just those rows. A key names one row, so the outer statement needs no LIMIT.
    const isSortedPage =
      this.ordering !== undefined && this.limitValue !== undefined && !this.isDistinct;
    if (isSortedPage) {
      const key = this.key.join(", ");
      const page = this.joinClauses([
        `SELECT ${key}`,
        `FROM ${this.fromClause}`,
        where,
        order,
        limitClause,
        offsetClause,
      ]);
      return this.joinClauses([
        `SELECT ${projection}`,
        `FROM ${this.fromClause}`,
        `WHERE (${key}) IN (${page})`,
        order,
      ]);
    }

    return this.joinClauses([
      `${selectKeyword} ${projection}`,
      `FROM ${this.fromClause}`,
      where,
      order,
      limitClause,
      offsetClause,
    ]);
  }

  private outputColumn(name: string): StoreOutputColumn {
    const field = this.flattenedFields().find(({ key }) => key === name);
    if (field !== undefined) {
      return { name, type: this.variantCastType(field.field.type) };
    }
    const whole = this.variantColumns.find(
      ({ column, schema }) => column === name && !VariantSchema.isObject(schema),
    );
    if (whole !== undefined) {
      return { name, type: this.variantCastType(whole.schema) };
    }
    const { type, idOf } = this.baseColumn(name);
    return { name, type, idOf };
  }

  /** Integers come back as text: ids pass 2^53, which a JavaScript number cannot hold. */
  private projectedValue(name: string, type: string): string {
    const expression = this.projectedExpression(name);
    const isInteger = type === "BIGINT" || type === "INT";
    return isInteger ? `toString(${expression})` : expression;
  }

  private projectedExpression(name: string): string {
    const field = this.fieldExpressions().get(name);
    if (field !== undefined) {
      return field;
    }
    const whole = this.variantColumns.find(
      ({ column, schema }) => column === name && !VariantSchema.isObject(schema),
    );
    return whole === undefined ? this.baseColumn(name).expression : this.wholeColumn(whole);
  }

  /** Spark sorts nulls first going up and last going down; the store puts them last both ways. */
  private sortClause({ column, direction = "ASC", mode, idOrder }: StoreOrdering): string {
    const nulls = direction === "ASC" ? "NULLS FIRST" : "NULLS LAST";
    if (idOrder !== undefined) {
      const [name] = this.structPath(column);
      const ids = idOrder.map((id) => this.escapeValue(id)).join(", ");
      return `indexOf([${ids}], ${this.baseColumn(name).expression}) ${direction} ${nulls}`;
    }

    const target = this.columnExpression(column);
    if (mode?.kind === "numericString") {
      const rowId = !this.isDistinct && mode.rowId ? this.columnExpression(mode.rowId) : undefined;
      return numericStringOrdering(this.numericStringKeys(target, rowId), direction);
    }
    const sorted =
      mode?.kind === "pseudonym" ? this.contributorPseudonym(target, mode.salt) : target;
    return `${sorted} ${direction} ${nulls}`;
  }

  /** The warehouse's keys for text that holds a number, in the store's functions. */
  private numericStringKeys(value: string, rowId?: string): NumericStringKeys {
    const trimmed = `trim(BOTH concat(char(9), char(10), char(11), char(12), char(13), ' ') FROM ${value})`;
    const representable = `match(${trimmed}, '^[+-]?(?:0*[0-9]{1,20}(?:[.][0-9]{0,18}0*)?|[.][0-9]{1,18}0*)$')`;
    const decimal = `CASE WHEN ${representable} THEN toDecimal128OrNull(${trimmed}, 18) END`;
    const group = `CASE WHEN (${decimal}) IS NOT NULL THEN 0 WHEN ${trimmed} IS NULL OR ${trimmed} = '' THEN 2 ELSE 1 END`;
    return { group, decimal, value, rowId };
  }

  private serialNumberOf(clientIdSql: string): string {
    const ids = this.deviceSerials.map(([clientId]) => this.escapeValue(clientId));
    const serials = this.deviceSerials.map(([, serial]) =>
      serial === null ? "NULL" : this.escapeValue(serial),
    );
    return `arrayElement(CAST([${serials.join(", ")}] AS Array(Nullable(String))), indexOf([${ids.join(", ")}], ${clientIdSql}))`;
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
    const field = this.flattenedFields().find(({ key }) => key === column);
    if (field !== undefined) {
      return this.variantCastType(field.field.type);
    }
    const [name, path] = this.structPath(column);
    return path === undefined ? this.baseColumn(name).type : "STRING";
  }

  private fieldExpressions(): Map<string, string> {
    return new Map(
      this.flattenedFields().map(({ key, column, field }) => [
        key,
        this.fieldExpression(column, field),
      ]),
    );
  }

  private flattenedFields(): FlattenedField[] {
    return FlattenedFields.resolve(this.reservedColumns, this.variantColumns);
  }

  /**
   * A scalar reads as its type and is null when the value holds another, as `try_variant_get`
   * reads it. Anything else reads as JSON, which the adapter writes out as the warehouse does.
   * Answers are a map of text, so every answer reads by key.
   */
  private fieldExpression(column: string, field: VariantField): string {
    const type = this.variantCastType(field.type);
    if (column === "questions_data") {
      const answer = `${column}[${this.escapeValue(field.name)}]`;
      return type === "STRING" ? answer : this.typedScalar(answer, type);
    }

    // Quoted, the payload column would read as a table name before its subcolumn.
    const path = `${column}.${this.subcolumn(field.name)}`;
    const object = `${column}.^${this.subcolumn(field.name)}`;
    return this.typedValue(path, object, type);
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
