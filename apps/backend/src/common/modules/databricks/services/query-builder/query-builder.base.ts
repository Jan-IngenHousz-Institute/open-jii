export abstract class BaseQueryBuilder {
  abstract select(columns?: string[]): this;
  abstract from(table: string): this;
  abstract where(condition: string): this;
  abstract limit(value: number): this;
  abstract offset(value: number): this;
  abstract build(): string;

  /**
   * Escape a SQL identifier (table name, column name, etc.)
   * Wraps identifier in backticks to handle special characters and reserved words
   */
  escapeIdentifier(identifier: string): string {
    return `\`${identifier.replace(/`/g, "``")}\``;
  }

  /**
   * Escape a string value for SQL
   * Escapes single quotes to prevent SQL injection
   */
  escapeValue(value: string): string {
    return `'${value.replace(/'/g, "''")}'`;
  }

  /**
   * Build a simple WHERE clause with AND conditions
   * Each condition should be a tuple of [column, value]
   */
  buildWhereClause(conditions: [string, string][]): string {
    return conditions
      .map(([column, value]) => `${this.escapeIdentifier(column)} = ${this.escapeValue(value)}`)
      .join(" AND ");
  }

  /**
   * Transform VARIANT schema from schema_of_variant_agg() to from_json() compatible schema.
   * Replaces OBJECT<...> with STRUCT<...> for DDL compatibility.
   *
   * Example:
   * Input:  "OBJECT<phi2: DOUBLE, messages: OBJECT<text: STRING>>"
   * Output: "STRUCT<phi2: DOUBLE, messages: STRUCT<text: STRING>>"
   */
  transformSchemaForFromJson(variantSchema: string): string {
    if (!variantSchema) {
      return "";
    }

    // Replace all occurrences of OBJECT with STRUCT
    // This handles nested OBJECT types as well
    return variantSchema.replace(/OBJECT</g, "STRUCT<");
  }
}

/**
 * SQL Query Builder using fluent interface pattern
 */
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

  /**
   * Set raw SQL expression for SELECT clause (without identifier escaping)
   * Use this for aggregate functions, expressions, etc.
   */
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
    // Handle nested struct field access (e.g., "contributor.name")
    // Split by dot and escape each part separately
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
    if (this.exceptColumns.length > 0) {
      const exceptList = this.exceptColumns.map((c) => this.escapeIdentifier(c)).join(", ");
      selectPart = `${this.selectClause} EXCEPT (${exceptList})`;
    }

    let query = `SELECT ${selectPart} FROM ${this.fromClause}`;

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

/**
 * VARIANT Query Builder for parsing VARIANT columns
 */
export class VariantQueryBuilder extends BaseQueryBuilder {
  private selectClause = "*";
  private fromClause = "";
  private variantColumns: { column: string; schema: string; alias: string }[] = [];
  private whereConditions: string[] = [];
  private orderByClause?: string;
  private limitValue?: number;
  private offsetValue?: number;
  private exceptColumns: string[] = [];

  select(columns?: string[]): this {
    if (columns && columns.length > 0) {
      this.selectClause = columns.join(",\n    ");
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

  where(condition: string): this {
    this.whereConditions.push(condition);
    return this;
  }

  orderBy(column: string, direction: "ASC" | "DESC" = "ASC"): this {
    // Handle nested struct field access (e.g., "contributor.name")
    // Split by dot and escape each part separately
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

    // Build WHERE, ORDER BY, LIMIT, OFFSET clauses
    const where =
      this.whereConditions.length > 0 ? `WHERE ${this.whereConditions.join(" AND ")}` : "";
    const order = this.orderByClause ? `ORDER BY ${this.orderByClause}` : "";
    const limitClause = this.limitValue ? `LIMIT ${this.limitValue}` : "";
    const offsetClause = this.offsetValue ? `OFFSET ${this.offsetValue}` : "";

    // Columns to exclude from final result (raw VARIANTs, parsed aliases, and user-specified)
    const allExceptColumns = [
      ...this.variantColumns.flatMap((v) => [v.column, v.alias]),
      ...this.exceptColumns,
    ].join(", ");

    // Generate from_json() calls to parse each VARIANT column
    const parsedColumns = this.variantColumns
      .map((v) => {
        const transformedSchema = this.transformSchemaForFromJson(v.schema);
        return `from_json(${v.column}::string, '${transformedSchema}') as ${v.alias}`;
      })
      .join(",\n          ");

    // Generate expansion expressions (parsed_alias.*) to flatten VARIANT fields
    const expandedColumns = this.variantColumns.map((v) => `${v.alias}.*`).join(",\n        ");

    // Three-level query structure:
    // Level 1 (innermost): Get all base columns + parse VARIANTs with from_json()
    // Level 2 (middle): Flatten VARIANT fields to same level as base columns
    // Level 3 (outermost, conditional): Filter to specific columns if requested
    const flattenedView = `
      SELECT 
        * EXCEPT (${allExceptColumns}),
        ${expandedColumns}
      FROM (
        SELECT 
          *,
          ${parsedColumns}
        FROM ${this.fromClause}
        ${where}
      )
    `.trim();

    // Add outer SELECT for column filtering if specific columns requested
    if (this.selectClause !== "*") {
      return `
        SELECT ${this.selectClause}
        FROM (
          ${flattenedView}
        )
        ${order}
        ${limitClause}
        ${offsetClause}
      `.trim();
    }

    // Return flattened view with ordering/limiting
    return `
      ${flattenedView}
      ${order}
      ${limitClause}
      ${offsetClause}
    `.trim();
  }
}
