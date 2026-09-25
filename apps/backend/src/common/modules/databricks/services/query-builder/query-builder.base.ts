import { buildAggregateExpression } from "./expressions/aggregation";
import { buildCumsumExpression } from "./expressions/cumsum";
import { buildFilterCondition } from "./expressions/filter";
import { buildTimeBucketExpression } from "./expressions/time-bucket";
import type {
  AggregateExpression,
  FilterCondition,
  FilterValue,
  TimeBucketUnit,
} from "./query-builder.types";
import { VariantSchema } from "./schema/variant-schema";
import type { VariantField } from "./schema/variant-schema";

export abstract class BaseQueryBuilder {
  protected isDistinct = false;

  abstract select(columns?: string[]): this;
  abstract from(table: string): this;
  abstract where(condition: string): this;
  abstract limit(value: number): this;
  abstract offset(value: number): this;
  abstract build(): string;

  /** Emit `SELECT DISTINCT` instead of `SELECT`. */
  distinct(): this {
    this.isDistinct = true;
    return this;
  }

  /**
   * Escape a SQL identifier (table, column, struct field path).
   *
   * Dotted paths (e.g. `contributor.name` to address a well-known sortable
   * struct's display field) are split on `.` and each segment is escaped
   * independently, yielding `` `contributor`.`name` ``. Bare identifiers
   * pass through with one set of backticks.
   */
  escapeIdentifier(identifier: string): string {
    return identifier
      .split(".")
      .map((part) => `\`${part.replace(/`/g, "``")}\``)
      .join(".");
  }

  /**
   * SQL string literal. Databricks reads backslash escapes inside literals and joins adjacent
   * literals, so a doubled quote would split the value; backslashes are escaped before quotes.
   */
  escapeValue(value: string): string {
    return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  }

  /**
   * Render a scalar filter value to its SQL literal form. Caller is
   * responsible for routing arrays through the IN-operator builder; passing
   * an array here is a programming error.
   */
  escapeScalarValue(value: Exclude<FilterValue, (string | number)[]>): string {
    if (typeof value === "string") {
      return this.escapeValue(value);
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        throw new Error("Non-finite numeric values cannot be rendered to SQL");
      }
      return String(value);
    }
    if (typeof value === "boolean") {
      return value ? "true" : "false";
    }
    throw new Error(`Unsupported scalar filter value type: ${typeof value}`);
  }

  /**
   * SQL for a column a filter or ordering names. A plain column is its escaped identifier; the
   * variant builder resolves a flattened field to the expression that extracts it.
   */
  columnExpression(column: string): string {
    return this.escapeIdentifier(column);
  }

  buildFilterCondition(filter: FilterCondition): string {
    return buildFilterCondition(filter, this);
  }

  /**
   * Apply a single user filter to the WHERE clause. Returning `this` keeps the fluent chain so
   * callers can do `builder.filter(a).filter(b)` or loop over a list.
   */
  filter(condition: FilterCondition): this {
    this.where(this.buildFilterCondition(condition));
    return this;
  }

  buildTimeBucketExpression(column: string, unit: TimeBucketUnit): { sql: string; alias: string } {
    return buildTimeBucketExpression(column, unit, this);
  }

  buildAggregateExpression(agg: AggregateExpression): { sql: string; alias: string } {
    return buildAggregateExpression(agg, this);
  }

  buildCumsumExpression(
    agg: AggregateExpression,
    opts: { orderBy: string; grouped: boolean },
  ): { sql: string; alias: string } {
    return buildCumsumExpression(agg, opts, this);
  }

  /** AND-joined `column = value` equality conditions from [column, value] tuples. */
  buildWhereClause(conditions: [string, string][]): string {
    return conditions
      .map(([column, value]) => `${this.escapeIdentifier(column)} = ${this.escapeValue(value)}`)
      .join(" AND ");
  }

  /**
   * Turn a field type from schema_of_variant_agg() into a type a VARIANT can be cast to.
   *
   * - OBJECT< to STRUCT<: schema_of_variant_agg uses Spark's VARIANT DDL (OBJECT); casts want STRUCT.
   * - VOID to STRING: schema_of_variant_agg emits VOID for a field that is null in every aggregated
   *   row and for the elements of an array that is empty in every row, and VOID is no cast target.
   *   Those values read back as null or as an empty array.
   *
   * Example:
   *   Input:  "ARRAY<OBJECT<text: STRING, dead: VOID, none: ARRAY<VOID>>>"
   *   Output: "ARRAY<STRUCT<text: STRING, dead: STRING, none: ARRAY<STRING>>>"
   */
  variantCastType(fieldType: string): string {
    // VOID as a whole type token; a field named VOID is followed by `:` and stays.
    return fieldType
      .replaceAll("OBJECT<", "STRUCT<")
      .replace(/(^|[<,:]\s*)VOID(?=\s*(?:[>,]|$))/g, "$1STRING");
  }
}

export class SqlQueryBuilder extends BaseQueryBuilder {
  private selectClause = "*";
  private fromClause = "";
  private whereConditions: string[] = [];
  private groupByColumns: string[] = [];
  private orderByClause?: string;
  private limitValue?: number;
  private offsetValue?: number;
  private exceptColumns: string[] = [];

  select(columns?: string[]): this {
    if (columns && columns.length > 0) {
      this.selectClause = columns.map((c) => this.escapeIdentifier(c)).join(", ");
    }
    return this;
  }

  /** Raw SELECT expression, not identifier-escaped. For aggregates/expressions. */
  selectRaw(expression: string): this {
    this.selectClause = expression;
    return this;
  }

  from(table: string): this {
    this.fromClause = table;
    return this;
  }

  where(condition: string): this {
    this.whereConditions.push(condition);
    return this;
  }

  whereEquals(column: string, value: string): this {
    const condition = `${this.escapeIdentifier(column)} = ${this.escapeValue(value)}`;
    this.whereConditions.push(condition);
    return this;
  }

  groupBy(columns: string | string[]): this {
    const cols = Array.isArray(columns) ? columns : [columns];
    this.groupByColumns = cols.map((c) => this.escapeIdentifier(c));
    return this;
  }

  orderBy(column: string, direction: "ASC" | "DESC" = "ASC"): this {
    // Struct field paths (e.g. "contributor.name") escape per segment.
    if (column.includes(".")) {
      const parts = column.split(".");
      const escapedParts = parts.map((part) => this.escapeIdentifier(part));
      this.orderByClause = `${escapedParts.join(".")} ${direction}`;
    } else {
      this.orderByClause = `${this.escapeIdentifier(column)} ${direction}`;
    }
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

  /**
   * Exclude columns from the final SELECT
   */
  except(columns: string[]): this {
    this.exceptColumns.push(...columns);
    return this;
  }

  build(): string {
    if (!this.fromClause) {
      throw new Error("FROM clause is required");
    }

    let selectPart = this.selectClause;
    // Databricks/Spark only accepts EXCEPT after a star projection (`*` or
    // `tbl.*`). Combining it with an explicit column list throws
    // PARSE_SYNTAX_ERROR, and it would be redundant anyway since
    // un-listed columns are already excluded by virtue of not being
    // projected. Drop EXCEPT silently in that case.
    if (this.exceptColumns.length > 0 && this.selectClause === "*") {
      const exceptList = this.exceptColumns.map((c) => this.escapeIdentifier(c)).join(", ");
      selectPart = `* EXCEPT (${exceptList})`;
    }

    const selectKeyword = this.isDistinct ? "SELECT DISTINCT" : "SELECT";
    let query = `${selectKeyword} ${selectPart} FROM ${this.fromClause}`;

    if (this.whereConditions.length > 0) {
      query += ` WHERE ${this.whereConditions.join(" AND ")}`;
    }

    if (this.groupByColumns.length > 0) {
      query += ` GROUP BY ${this.groupByColumns.join(", ")}`;
    }

    if (this.orderByClause) {
      query += ` ORDER BY ${this.orderByClause}`;
    }

    if (this.limitValue !== undefined) {
      query += ` LIMIT ${this.limitValue}`;
      if (this.offsetValue !== undefined) {
        query += ` OFFSET ${this.offsetValue}`;
      }
    }

    return query;
  }
}

interface VariantColumn {
  column: string;
  schema: string;
  fields: VariantField[];
}

/**
 * Reads VARIANT columns by typed path in a single SELECT. Each top-level field of a column's
 * schema is its own `try_variant_get` expression, so a query evaluates only the fields it uses,
 * and a value of another type reads as null instead of failing the query.
 */
export class VariantQueryBuilder extends BaseQueryBuilder {
  private selectColumns?: string[];
  private fromClause = "";
  private variantColumns: VariantColumn[] = [];
  private whereConditions: string[] = [];
  private ordering?: { column: string; direction: "ASC" | "DESC" };
  private limitValue?: number;
  private offsetValue?: number;
  private exceptColumns: string[] = [];

  select(columns?: string[]): this {
    if (columns && columns.length > 0) {
      this.selectColumns = columns;
    }
    return this;
  }

  from(table: string): this {
    this.fromClause = table;
    return this;
  }

  parseVariant(column: string, schema: string): this {
    this.variantColumns.push({ column, schema, fields: VariantSchema.topLevelFields(schema) });
    return this;
  }

  columnExpression(column: string): string {
    return this.fieldExpressions().get(column) ?? super.columnExpression(column);
  }

  where(condition: string): this {
    this.whereConditions.push(condition);
    return this;
  }

  orderBy(column: string, direction: "ASC" | "DESC" = "ASC"): this {
    this.ordering = { column, direction };
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

  /**
   * Exclude additional columns from the final SELECT
   */
  except(columns: string[]): this {
    this.exceptColumns.push(...columns);
    return this;
  }

  build(): string {
    if (!this.fromClause) {
      throw new Error("FROM clause is required");
    }
    if (this.variantColumns.length === 0) {
      throw new Error("At least one VARIANT column is required");
    }

    const selectKeyword = this.isDistinct ? "SELECT DISTINCT" : "SELECT";
    const projection = this.selectColumns
      ? this.selectColumns.map((column) => this.projectColumn(column)).join(", ")
      : this.starProjection();
    const where =
      this.whereConditions.length > 0 ? `WHERE ${this.whereConditions.join(" AND ")}` : "";
    const order = this.ordering
      ? `ORDER BY ${this.orderTarget(this.ordering.column)} ${this.ordering.direction}`
      : "";
    const limitClause = this.limitValue ? `LIMIT ${this.limitValue}` : "";
    const offsetClause = this.offsetValue ? `OFFSET ${this.offsetValue}` : "";

    return [
      `${selectKeyword} ${projection}`,
      `FROM ${this.fromClause}`,
      where,
      order,
      limitClause,
      offsetClause,
    ]
      .filter((clause) => clause.length > 0)
      .join("\n");
  }

  /** Every base column but the raw VARIANTs, then every flattened field under its own name. A name
   *  in two VARIANT columns is projected once, from the first, as fieldExpressions resolves it. */
  private starProjection(): string {
    const excluded = [...this.variantColumns.map(({ column }) => column), ...this.exceptColumns];
    const projected = new Set<string>();
    const fields = this.variantColumns.flatMap((variant) => {
      if (!VariantSchema.isObject(variant.schema)) {
        return [this.wholeColumn(variant)];
      }

      const unprojected = variant.fields.filter((field) => !projected.has(field.name));
      unprojected.forEach((field) => projected.add(field.name));
      return unprojected.map(
        (field) =>
          `${this.fieldExpression(variant.column, field)} AS ${this.quoteName(field.name)}`,
      );
    });
    const exceptList = excluded.map((column) => this.escapeIdentifier(column)).join(", ");
    return [`* EXCEPT (${exceptList})`, ...fields].join(", ");
  }

  /** A VARIANT whose schema is no object (an array, a scalar, all nulls) has no fields to
   *  flatten, so it is read whole under its own name. */
  private wholeColumn({ column, schema }: VariantColumn): string {
    const castType = this.escapeValue(this.variantCastType(schema));
    return `try_variant_get(${this.escapeIdentifier(column)}, '$', ${castType}) AS ${this.quoteName(column)}`;
  }

  private projectColumn(column: string): string {
    const expression = this.fieldExpressions().get(column);
    return expression === undefined
      ? this.escapeIdentifier(column)
      : `${expression} AS ${this.quoteName(column)}`;
  }

  /** A projected field sorts by its output name, which DISTINCT requires; any other column by
   *  its expression. */
  private orderTarget(column: string): string {
    const isField = this.fieldExpressions().has(column);
    const isProjected = this.selectColumns === undefined || this.selectColumns.includes(column);
    return isField && isProjected ? this.quoteName(column) : this.columnExpression(column);
  }

  /** Field name to extraction SQL. A name in two VARIANT columns resolves to the first. */
  private fieldExpressions(): Map<string, string> {
    const expressions = new Map<string, string>();
    for (const { column, fields } of this.variantColumns) {
      for (const field of fields) {
        if (!expressions.has(field.name)) {
          expressions.set(field.name, this.fieldExpression(column, field));
        }
      }
    }
    return expressions;
  }

  /**
   * The JSON path syntax has no escape character, so a name holding `"` takes the single-quoted
   * form, and a name holding both quote kinds is looked up as a map key instead.
   */
  private fieldExpression(column: string, field: VariantField): string {
    const source = this.escapeIdentifier(column);
    const castType = this.variantCastType(field.type);

    if (!field.name.includes('"')) {
      const path = this.escapeValue(`$["${field.name}"]`);
      return `try_variant_get(${source}, ${path}, ${this.escapeValue(castType)})`;
    }
    if (!field.name.includes("'")) {
      const path = this.escapeValue(`$['${field.name}']`);
      return `try_variant_get(${source}, ${path}, ${this.escapeValue(castType)})`;
    }

    const value = `element_at(try_cast(${source} AS MAP<STRING, VARIANT>), ${this.escapeValue(field.name)})`;
    return `try_cast(${value} AS ${castType})`;
  }

  /** One identifier, never split on dots: a field name may contain them. */
  private quoteName(name: string): string {
    return `\`${name.replaceAll("`", "``")}\``;
  }
}
