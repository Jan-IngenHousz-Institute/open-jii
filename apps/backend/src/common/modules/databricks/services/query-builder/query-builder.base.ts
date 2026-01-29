import type { QueryBuilderService } from "./query-builder.service";

/**
 * SQL Query Builder using fluent interface pattern
 */
export class SqlQueryBuilder {
  private selectClause = "*";
  private fromClause = "";
  private whereConditions: string[] = [];
  private groupByColumns: string[] = [];
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
    const condition = `${this.escaper.escapeIdentifier(column)} = ${this.escaper.escapeValue(value)}`;
    this.whereConditions.push(condition);
    return this;
  }

  groupBy(columns: string | string[]): this {
    const cols = Array.isArray(columns) ? columns : [columns];
    this.groupByColumns = cols.map((c) => this.escaper.escapeIdentifier(c));
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
export class VariantQueryBuilder {
  private selectClause = "*";
  private fromClause = "";
  private variantColumns: Array<{ column: string; schema: string; alias: string }> = [];
  private whereConditions: string[] = [];
  private orderByClause?: string;
  private limitValue?: number;
  private offsetValue?: number;
  private exceptColumns: string[] = [];

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

    const innerSelect = this.selectClause;

    // Generate EXCEPT clause for all variant columns, their parsed aliases, and additional except columns
    const allExceptColumns = [
      ...this.variantColumns.flatMap((v) => [v.column, v.alias]),
      ...this.exceptColumns,
    ].join(", ");

    const outerSelect =
      this.selectClause === "*" ? `* EXCEPT (${allExceptColumns})` : this.selectClause;

    const where =
      this.whereConditions.length > 0 ? `WHERE ${this.whereConditions.join(" AND ")}` : "";
    const order = this.orderByClause ? `ORDER BY ${this.orderByClause}` : "";
    const limitClause = this.limitValue ? `LIMIT ${this.limitValue}` : "";
    const offsetClause = this.offsetValue ? `OFFSET ${this.offsetValue}` : "";

    // Generate from_json calls for each VARIANT column
    const parsedColumns = this.variantColumns
      .map((v) => {
        const transformedSchema = v.schema.replace(/OBJECT</g, "STRUCT<");
        return `from_json(${v.column}::string, '${transformedSchema}') as ${v.alias}`;
      })
      .join(",\n          ");

    // Generate expansion for all parsed columns
    const expandedColumns = this.variantColumns.map((v) => `${v.alias}.*`).join(",\n        ");

    return `
      SELECT 
        ${outerSelect},
        ${expandedColumns}
      FROM (
        SELECT 
          ${innerSelect},
          ${parsedColumns}
        FROM ${this.fromClause}
        ${where}
      )
      ${order}
      ${limitClause}
      ${offsetClause}
    `.trim();
  }
}
