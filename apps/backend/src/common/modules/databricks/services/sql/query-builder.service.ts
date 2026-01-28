import { Injectable } from "@nestjs/common";

/**
 * SQL Query Builder using fluent interface pattern
 */
class SqlQueryBuilder {
  private selectClause = "*";
  private fromClause = "";
  private whereConditions: string[] = [];
  private orderByClause?: string;
  private limitValue?: number;
  private offsetValue?: number;

  constructor(private readonly escaper: QueryBuilderService) {}

  select(columns?: string[]): this {
    if (columns && columns.length > 0) {
      this.selectClause = columns.map((c) => this.escaper.escapeIdentifier(c)).join(", ");
    } else {
      this.selectClause = "*";
    }
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
    const condition = `${this.escaper.escapeIdentifier(column)} = ${this.escaper.escapeValue(value)}`;
    this.whereConditions.push(condition);
    return this;
  }

  orderBy(column: string, direction: "ASC" | "DESC" = "ASC"): this {
    this.orderByClause = `${this.escaper.escapeIdentifier(column)} ${direction}`;
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

  build(): string {
    if (!this.fromClause) {
      throw new Error("FROM clause is required");
    }

    let query = `SELECT ${this.selectClause} FROM ${this.fromClause}`;

    if (this.whereConditions.length > 0) {
      query += ` WHERE ${this.whereConditions.join(" AND ")}`;
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
class VariantQueryBuilder {
  private selectClause = "*";
  private fromClause = "";
  private variantColumn = "";
  private variantSchema = "";
  private whereConditions: string[] = [];
  private orderByClause?: string;
  private limitValue?: number;
  private offsetValue?: number;

  constructor(private readonly escaper: QueryBuilderService) {}

  select(columns?: string[]): this {
    if (columns && columns.length > 0) {
      this.selectClause = columns.join(",\n    ");
    } else {
      this.selectClause = "*";
    }
    return this;
  }

  from(table: string): this {
    this.fromClause = table;
    return this;
  }

  parseVariant(column: string, schema: string): this {
    this.variantColumn = column;
    this.variantSchema = schema;
    return this;
  }

  where(condition: string): this {
    this.whereConditions.push(condition);
    return this;
  }

  orderBy(orderBy: string): this {
    this.orderByClause = orderBy;
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

  build(): string {
    if (!this.fromClause) {
      throw new Error("FROM clause is required");
    }
    if (!this.variantColumn || !this.variantSchema) {
      throw new Error("VARIANT column and schema are required");
    }

    const innerSelect = this.selectClause;
    const outerSelect =
      this.selectClause === "*"
        ? `* EXCEPT (${this.variantColumn}, parsed_output)`
        : this.selectClause;

    const where =
      this.whereConditions.length > 0 ? `WHERE ${this.whereConditions.join(" AND ")}` : "";
    const order = this.orderByClause ? `ORDER BY ${this.orderByClause}` : "";
    const limitClause = this.limitValue ? `LIMIT ${this.limitValue}` : "";
    const offsetClause = this.offsetValue ? `OFFSET ${this.offsetValue}` : "";

    // Transform OBJECT → STRUCT
    const transformedSchema = this.variantSchema.replace(/OBJECT</g, "STRUCT<");

    return `
      SELECT 
        ${outerSelect},
        parsed_output.*
      FROM (
        SELECT 
          ${innerSelect},
          from_json(${this.variantColumn}::string, '${transformedSchema}') as parsed_output
        FROM ${this.fromClause}
        ${where}
      )
      ${order}
      ${limitClause}
      ${offsetClause}
    `.trim();
  }
}

/**
 * SQL Query Builder Service
 *
 * Provides safe, generic SQL statement building utilities for Databricks queries.
 * Uses fluent builder pattern for composing queries.
 * Domain-agnostic - does not know about specific catalogs, schemas, or business logic.
 */
@Injectable()
export class QueryBuilderService {
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
   * Create a new SQL query builder
   */
  query(): SqlQueryBuilder {
    return new SqlQueryBuilder(this);
  }

  /**
   * Create a new VARIANT query builder
   */
  variantQuery(): VariantQueryBuilder {
    return new VariantQueryBuilder(this);
  }

  /**
   * Build a SELECT query with optional WHERE, ORDER BY, LIMIT, and OFFSET
   * Legacy method - prefer using query() builder
   */
  buildSelectQuery(params: {
    table: string;
    columns?: string[];
    whereClause?: string;
    whereConditions?: [string, string][];
    orderBy?: string;
    orderDirection?: "ASC" | "DESC";
    limit?: number;
    offset?: number;
  }): string {
    const { table, columns, whereClause, whereConditions, orderBy, orderDirection, limit, offset } =
      params;

    const builder = this.query().from(table).select(columns);

    if (whereClause) {
      builder.where(whereClause);
    } else if (whereConditions) {
      const clause = this.buildWhereClause(whereConditions);
      builder.where(clause);
    }

    if (orderBy) {
      builder.orderBy(orderBy, orderDirection);
    }

    if (limit !== undefined) {
      builder.limit(limit);
    }

    if (offset !== undefined) {
      builder.offset(offset);
    }

    return builder.build();
  }

  /**
   * Build a COUNT query with optional WHERE clause
   * Legacy method - prefer using query() builder
   */
  buildCountQuery(params: {
    table: string;
    whereClause?: string;
    whereConditions?: [string, string][];
  }): string {
    const { table, whereClause, whereConditions } = params;

    const builder = this.query().select(["COUNT(*)"]).from(table);

    if (whereClause) {
      builder.where(whereClause);
    } else if (whereConditions) {
      const clause = this.buildWhereClause(whereConditions);
      builder.where(clause);
    }

    return builder.build();
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

  /**
   * Build a SQL query to parse VARIANT column using provided schema.
   * Legacy method - prefer using variantQuery() builder
   *
   * Pattern:
   * 1. Parse VARIANT using from_json(variantColumn::string, schema)
   * 2. Expand all fields with parsed_output.*
   *
   * @param params.table - Fully qualified table name (catalog.schema.table)
   * @param params.selectColumns - Base columns to select (e.g., ["id", "timestamp"] or ["*"])
   * @param params.variantColumn - Name of the VARIANT column to parse
   * @param params.variantSchema - Schema string (will be transformed OBJECT->STRUCT)
   * @param params.whereClause - Optional WHERE clause
   * @param params.orderBy - Optional ORDER BY clause
   * @param params.limit - Optional LIMIT
   * @param params.offset - Optional OFFSET
   */
  buildVariantParseQuery(params: {
    table: string;
    selectColumns: string[];
    variantColumn: string;
    variantSchema: string;
    whereClause?: string;
    orderBy?: string;
    limit?: number;
    offset?: number;
  }): string {
    const {
      table,
      selectColumns,
      variantColumn,
      variantSchema,
      whereClause,
      orderBy,
      limit,
      offset,
    } = params;

    const builder = this.variantQuery()
      .from(table)
      .select(selectColumns)
      .parseVariant(variantColumn, variantSchema);

    if (whereClause) {
      builder.where(whereClause);
    }

    if (orderBy) {
      builder.orderBy(orderBy);
    }

    if (limit !== undefined) {
      builder.limit(limit);
    }

    if (offset !== undefined) {
      builder.offset(offset);
    }

    return builder.build();
  }
}
