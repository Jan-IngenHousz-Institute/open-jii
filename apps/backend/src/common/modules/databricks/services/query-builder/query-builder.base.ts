import type { QueryBuilderService } from "./query-builder.service";

/**
 * SQL Query Builder using fluent interface pattern
 */
export class SqlQueryBuilder {
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
export class VariantQueryBuilder {
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
