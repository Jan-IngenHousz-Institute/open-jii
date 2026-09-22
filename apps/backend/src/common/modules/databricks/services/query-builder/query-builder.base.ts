import { buildAggregateExpression } from "./expressions/aggregation";
import { buildCumsumExpression } from "./expressions/cumsum";
import { buildFilterCondition } from "./expressions/filter";
import { buildTimeBucketExpression } from "./expressions/time-bucket";
import type {
  AggregateExpression,
  FilterCondition,
  FilterValue,
  JoinSpec,
  TimeBucketUnit,
} from "./query-builder.types";
import { VariantSchema } from "./schema/variant-schema";

export abstract class BaseQueryBuilder {
  protected isDistinct = false;
  protected joins: JoinSpec[] = [];

  /** Alias for the served relation, so a star projection can stay scoped to it. */
  protected readonly baseAlias = "base";

  join(spec: JoinSpec): this {
    this.joins.push(spec);
    return this;
  }

  /** `<table> base LEFT JOIN ...`, or the bare table when nothing joins. */
  protected buildFromClause(table: string): string {
    if (this.joins.length === 0) {
      return table;
    }

    const joined = this.joins.map((join) => {
      const on = join.on
        .map(({ served, joined: joinedColumn, servedIsExpression }) => {
          const left = servedIsExpression
            ? served
            : `${this.baseAlias}.${this.escapeIdentifier(served)}`;

          return `${left} = ${join.alias}.${this.escapeIdentifier(joinedColumn)}`;
        })
        .join(" AND ");

      return `LEFT JOIN ${join.table} ${join.alias} ON ${on}`;
    });

    return `${table} ${this.baseAlias} ${joined.join(" ")}`;
  }

  /**
   * The star to project. Scoped to the served relation once anything joins, so
   * the joined tables' own key columns never reach the result.
   */
  protected buildBaseStar(): string {
    return this.joins.length > 0 ? `${this.baseAlias}.*` : "*";
  }

  /** The aliased expression a join contributes for this name, if any. */
  protected joinProjectionFor(alias: string): string | null {
    for (const join of this.joins) {
      for (const column of join.select) {
        if (column.alias === alias) {
          return `${column.expression} AS ${this.escapeIdentifier(alias)}`;
        }
      }
    }

    return null;
  }

  /**
   * Whether a filter names a column a join produced. Such a column is a SELECT
   * alias, so it does not exist in the WHERE of the level that joins, and the
   * filter has to be applied one level up.
   */
  protected targetsJoinAlias(column: string): boolean {
    const root = column.split(".")[0];

    return this.joins.some((join) => join.select.some((selected) => selected.alias === root));
  }

  /**
   * Columns the joins re-project under a name the base relation already uses.
   * They have to leave the base star in the same SELECT that adds the join's
   * projection, or both survive into the next level under one name.
   */
  protected shadowedBy(exceptColumns: string[]): string[] {
    const aliases = new Set(
      this.joins.flatMap((join) => join.select.map((column) => column.alias)),
    );

    return exceptColumns.filter((column) => aliases.has(column));
  }

  /** Aliased expressions the joins contribute, or an empty string. */
  protected buildJoinProjection(): string {
    return this.joins
      .flatMap((join) =>
        join.select.map(
          (column) => `${column.expression} AS ${this.escapeIdentifier(column.alias)}`,
        ),
      )
      .join(", ");
  }

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

  /** SQL string literal; doubles single quotes to prevent injection. */
  escapeValue(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
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

  buildFilterCondition(filter: FilterCondition): string {
    return buildFilterCondition(filter, this);
  }

  /**
   * Star-projection column-exclusion clause. Spark spells it `* EXCEPT (...)`;
   * dialects override (DuckDB: `* EXCLUDE (...)`).
   */
  starExceptClause(columns: string[], star = "*"): string {
    const list = columns.map((c) => this.escapeIdentifier(c)).join(", ");
    return `${star} EXCEPT (${list})`;
  }

  /**
   * Deterministic contributor pseudonym over an already-escaped salt literal
   * and column SQL. Must stay byte-identical to
   * `ContributorAnonymizerService.pseudonymFor`: `Contributor-` + first 6
   * upper-hex of sha256 over `<experimentId>:<id>`. Dialects must preserve
   * Spark `concat`'s NULL propagation: a NULL id yields NULL, not a pseudonym.
   */
  pseudonymExpression(saltSql: string, colSql: string): string {
    return `concat('Contributor-', upper(substr(sha2(concat(${saltSql}, ${colSql}), 256), 1, 6)))`;
  }

  /**
   * Time-bucket expression over already-escaped column SQL. Spark coerces
   * string timestamps implicitly; dialects that don't must cast.
   */
  dateTruncExpression(unit: TimeBucketUnit, colSql: string): string {
    return `date_trunc('${unit.toUpperCase()}', ${colSql})`;
  }

  /**
   * FROM source that flattens an array column into one row per element.
   * Spark spells it `LATERAL VIEW EXPLODE`, which other engines do not parse.
   */
  explodeClause(innerSql: string, column: string, alias: string): string {
    return `(${innerSql}) LATERAL VIEW EXPLODE(${this.escapeIdentifier(column)}) AS ${this.escapeIdentifier(alias)}`;
  }

  /**
   * ORDER BY term for an already-escaped column. Spark's default null
   * placement (first ascending, last descending) is implicit here; dialects
   * that order nulls differently must spell it out or paginate differently.
   */
  orderByTerm(colSql: string, direction: "ASC" | "DESC"): string {
    return `${colSql} ${direction}`;
  }

  /**
   * Apply a single user filter to the WHERE clause. Default routes the
   * compiled SQL into `where(...)`; subclasses with multi-level WHEREs
   * (variant flattening) override to route flattened-field filters into
   * the post-flatten level instead.
   *
   * Returning `this` keeps the fluent chain so callers can do
   * `builder.filter(a).filter(b)` or loop over a list.
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
   * Transform a VARIANT schema string from schema_of_variant_agg() into one that from_json() accepts.
   *
   * - OBJECT< to STRUCT<: schema_of_variant_agg uses Spark's VARIANT DDL (OBJECT); from_json wants STRUCT.
   * - VOID to STRING: schema_of_variant_agg emits VOID for fields that exist on the JSON but are
   *   null across every aggregated row, and from_json rejects VOID inside a STRUCT. Coercing to
   *   STRING is safe; those fields parse back as null.
   *
   * Example:
   *   Input:  "OBJECT<phi2: DOUBLE, messages: OBJECT<text: STRING>, dead: VOID>"
   *   Output: "STRUCT<phi2: DOUBLE, messages: STRUCT<text: STRING>, dead: STRING>"
   */
  transformSchemaForFromJson(variantSchema: string): string {
    if (!variantSchema) {
      return "";
    }
    // ": VOID" is unambiguous as a type token: DDL field identifiers can't contain
    // ":" or spaces, so this only matches the type position, never a field name.
    return variantSchema.replaceAll("OBJECT<", "STRUCT<").replaceAll(": VOID", ": STRING");
  }
}

export class SqlQueryBuilder extends BaseQueryBuilder {
  protected selectClause = "*";
  protected fromClause = "";
  protected whereConditions: string[] = [];
  protected groupByColumns: string[] = [];
  protected orderByClause?: string;
  protected limitValue?: number;
  protected offsetValue?: number;
  protected exceptColumns: string[] = [];
  /** Filters naming an enrichment column; applied above the join. */
  protected postJoinConditions: string[] = [];
  /** The requested columns, kept so the projection can be rebuilt in build(). */
  protected selectedColumns: string[] = [];

  select(columns?: string[]): this {
    if (columns && columns.length > 0) {
      this.selectedColumns = [...columns];
      this.selectClause = columns.map((c) => this.escapeIdentifier(c)).join(", ");
    }
    return this;
  }

  filter(condition: FilterCondition): this {
    const sql = this.buildFilterCondition(condition);

    if (this.targetsJoinAlias(condition.column)) {
      this.postJoinConditions.push(sql);
    } else {
      this.where(sql);
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
      this.orderByClause = this.orderByTerm(escapedParts.join("."), direction);
    } else {
      this.orderByClause = this.orderByTerm(this.escapeIdentifier(column), direction);
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
    // `tbl.*`), so an explicit list applies the same rules by construction:
    // an excluded column is left out, and an enrichment column is taken from
    // the join that supplies it rather than the relation that does not.
    if (this.selectClause !== "*" && this.selectedColumns.length > 0) {
      selectPart = this.selectedColumns
        .filter((column) => !this.exceptColumns.includes(column))
        .map((column) => this.joinProjectionFor(column) ?? this.escapeIdentifier(column))
        .join(", ");
    }

    if (this.selectClause === "*") {
      const star = this.buildBaseStar();
      selectPart =
        this.exceptColumns.length > 0 ? this.starExceptClause(this.exceptColumns, star) : star;

      const joinProjection = this.buildJoinProjection();
      if (joinProjection) {
        selectPart = `${selectPart}, ${joinProjection}`;
      }
    }

    const selectKeyword = this.isDistinct ? "SELECT DISTINCT" : "SELECT";
    const where =
      this.whereConditions.length > 0 ? ` WHERE ${this.whereConditions.join(" AND ")}` : "";

    // Filter before joining. It is the cheaper order, and it keeps a bare
    // `experiment_id` in the WHERE from being ambiguous between the served
    // relation and a joined one.
    let query =
      this.joins.length > 0
        ? `${selectKeyword} ${selectPart} FROM ${this.buildFromClause(`(SELECT * FROM ${this.fromClause}${where})`)}`
        : `${selectKeyword} ${selectPart} FROM ${this.fromClause}${where}`;

    if (this.postJoinConditions.length > 0) {
      query = `SELECT * FROM (${query}) WHERE ${this.postJoinConditions.join(" AND ")}`;
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

export class VariantQueryBuilder extends BaseQueryBuilder {
  protected selectClause = "*";
  protected fromClause = "";
  protected variantColumns: { column: string; schema: string; alias: string }[] = [];
  protected whereConditions: string[] = [];
  /**
   * WHERE conditions that must run *after* VARIANT flattening, i.e. they
   * reference fields that only exist as columns once `parsed_*.*` has
   * been spliced in. Kept separate from `whereConditions` (which run at
   * the inner subquery level) so flattened-field filters resolve and
   * base-column filters stay efficient.
   */
  protected whereFlattenedConditions: string[] = [];
  protected orderByClause?: string;
  protected limitValue?: number;
  protected offsetValue?: number;
  protected exceptColumns: string[] = [];

  select(columns?: string[]): this {
    if (columns && columns.length > 0) {
      // Backtick-escape every identifier so column names with spaces or
      // reserved words work.
      this.selectClause = columns.map((c) => this.escapeIdentifier(c)).join(",\n    ");
    }
    return this;
  }

  from(table: string): this {
    this.fromClause = table;
    return this;
  }

  parseVariant(column: string, schema: string, alias?: string): this {
    this.variantColumns.push({
      column,
      schema,
      alias: alias ?? `parsed_${column}`,
    });
    return this;
  }

  /**
   * Route a user filter to the right WHERE level based on whether the
   * target column was flattened out of a variant schema:
   *
   *   - Flattened field (declared in any `parseVariant(...)` schema) →
   *     post-flatten `whereFlattened(...)`. Bare identifiers don't
   *     resolve pre-flatten.
   *   - Base column → inner `where(...)`, which shrinks the row set
   *     *before* `from_json` parses each row's struct. Compounds with
   *     `experiment_id` for non-trivial wins on large macro tables.
   *
   * The set of flattened fields is derived once per call from the
   * accumulated variant schemas, so callers don't have to compute it.
   */
  filter(condition: FilterCondition): this {
    const sql = this.buildFilterCondition(condition);
    if (this.flattenedFieldSet().has(condition.column) || this.targetsJoinAlias(condition.column)) {
      this.whereFlattened(sql);
    } else {
      this.where(sql);
    }
    return this;
  }

  /** Top-level field names exposed by every `parsed_*.*` projection on
   *  this builder. Owns its own variant schemas, so unlike the previous
   *  service-side helper, no parameter threading is needed. */
  private flattenedFieldSet(): Set<string> {
    const fields = new Set<string>();
    for (const v of this.variantColumns) {
      for (const name of VariantQueryBuilder.topLevelFieldNames(v.schema)) {
        fields.add(name);
      }
    }
    return fields;
  }

  static topLevelFieldNames(schema: string): string[] {
    return VariantSchema.topLevelFieldNames(schema);
  }

  where(condition: string): this {
    this.whereConditions.push(condition);
    return this;
  }

  /**
   * Add a WHERE condition evaluated *after* VARIANT flattening. Use this
   * for filters that reference fields produced by `parsed_*.*`; they
   * don't resolve at the inner level since the columns don't exist there
   * yet. Base-column filters should still go through `where()` so they
   * shrink the working set before flattening.
   */
  whereFlattened(condition: string): this {
    this.whereFlattenedConditions.push(condition);
    return this;
  }

  orderBy(column: string, direction: "ASC" | "DESC" = "ASC"): this {
    // Struct field paths (e.g. "contributor.name") escape per segment.
    if (column.includes(".")) {
      const parts = column.split(".");
      const escapedParts = parts.map((part) => this.escapeIdentifier(part));
      this.orderByClause = this.orderByTerm(escapedParts.join("."), direction);
    } else {
      this.orderByClause = this.orderByTerm(this.escapeIdentifier(column), direction);
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

    // Build WHERE, ORDER BY, LIMIT, OFFSET clauses. Two WHEREs: `where`
    // applies before flattening (cheap, but only base columns resolve);
    // `whereFlattened` applies after flattening (resolves `parsed_*.*`
    // fields like `Leaf Temperature` that only exist post-flatten).
    const where =
      this.whereConditions.length > 0 ? `WHERE ${this.whereConditions.join(" AND ")}` : "";
    const whereFlattened =
      this.whereFlattenedConditions.length > 0
        ? `WHERE ${this.whereFlattenedConditions.join(" AND ")}`
        : "";
    const order = this.orderByClause ? `ORDER BY ${this.orderByClause}` : "";
    const limitClause = this.limitValue ? `LIMIT ${this.limitValue}` : "";
    const offsetClause = this.offsetValue ? `OFFSET ${this.offsetValue}` : "";

    // Columns to exclude from final result (raw VARIANTs, parsed aliases, and user-specified)
    // Anything a join shadows is dropped one level down, so it must not be
    // named again here: by this point it is already gone.
    const shadowed = this.shadowedBy(this.exceptColumns);
    const allExceptColumns = [
      ...this.variantColumns.flatMap((v) => [v.column, v.alias]),
      ...this.exceptColumns.filter((column) => !shadowed.includes(column)),
    ].join(", ");
    const baseStar =
      shadowed.length > 0
        ? this.starExceptClause(shadowed, this.buildBaseStar())
        : this.buildBaseStar();

    const parsedColumns = this.variantColumns
      .map((v) => {
        const transformedSchema = this.transformSchemaForFromJson(v.schema);
        return `from_json(${v.column}::string, '${transformedSchema}') as ${v.alias}`;
      })
      .join(",\n          ");

    const expandedColumns = this.variantColumns.map((v) => `${v.alias}.*`).join(",\n        ");
    const joinProjection = this.buildJoinProjection();

    // Query structure:
    //   Level 1 (innermost): base columns + from_json() to parse VARIANTs.
    //     `where` runs here (against raw base columns, fast).
    //   Level 2: `* EXCEPT (...), parsed_*.*`: flattens struct fields to
    //     top-level columns.
    //   Level 3 (only when `whereFlattened` has conditions): plain
    //     `SELECT * FROM (level 2) WHERE …`. The wrapping is load-bearing:
    //     SQL evaluates WHERE *before* the surrounding SELECT projection,
    //     so a WHERE at level 2 only sees level 1's output columns
    //     (base + struct), not the flattened fields. The extra SELECT
    //     promotes the flattened fields into the FROM rowsource so the
    //     WHERE can reference them by their bare name.
    //   Level 4 (only when explicit `select` columns): final projection.
    // The join's projection and the variant parse cannot share a SELECT. The
    // parse reads a column the join aliases, which resolves only where lateral
    // alias support exists, and a base column of the same name would win over
    // the alias and drop the enrichment without an error.
    const joinedSource =
      this.joins.length > 0
        ? `(
        SELECT
          ${baseStar}${joinProjection ? `,\n          ${joinProjection}` : ""}
        FROM ${this.buildFromClause(`(SELECT * FROM ${this.fromClause} ${where})`)}
      )`
        : null;

    const flattenedView = `
      SELECT
        * EXCEPT (${allExceptColumns}),
        ${expandedColumns}
      FROM (
        SELECT
          ${joinedSource ? "*" : baseStar},
          ${parsedColumns}
        FROM ${joinedSource ?? `${this.fromClause}\n        ${where}`}
      )
    `.trim();
    const filteredFlattened =
      this.whereFlattenedConditions.length > 0
        ? `SELECT * FROM (${flattenedView}) ${whereFlattened}`.trim()
        : flattenedView;

    // Wrap in an outer SELECT so DISTINCT dedups on the projected columns,
    // not the raw VARIANT row.
    if (this.selectClause !== "*") {
      const selectKeyword = this.isDistinct ? "SELECT DISTINCT" : "SELECT";
      return `
        ${selectKeyword} ${this.selectClause}
        FROM (
          ${filteredFlattened}
        )
        ${order}
        ${limitClause}
        ${offsetClause}
      `.trim();
    }

    // Return flattened view with ordering/limiting
    return `
      ${filteredFlattened}
      ${order}
      ${limitClause}
      ${offsetClause}
    `.trim();
  }
}
