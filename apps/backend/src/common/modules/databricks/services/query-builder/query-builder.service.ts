import { Injectable } from "@nestjs/common";

import { SqlQueryBuilder, VariantQueryBuilder } from "./query-builder.base";
import type {
  CountQueryParams,
  SelectQueryParams,
  VariantParseQueryParams,
} from "./query-builder.types";

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
  buildSelectQuery(params: SelectQueryParams): string {
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
  buildCountQuery(params: CountQueryParams): string {
    const { table, whereClause, whereConditions } = params;

    const builder = this.query().selectRaw("COUNT(*)").from(table);

    if (whereClause) {
      builder.where(whereClause);
    } else if (whereConditions) {
      const clause = this.buildWhereClause(whereConditions);
      builder.where(clause);
    }

    return builder.build();
  }

  /**
   * Build an aggregate query with GROUP BY
   * @param table - Fully qualified table name
   * @param selectExpression - Raw SELECT expression (e.g., "col1, MAX(col2) as max_col2")
   * @param groupByColumns - Column(s) to group by
   * @param whereConditions - Optional WHERE conditions as [column, value] tuples
   */
  buildAggregateQuery(params: {
    table: string;
    selectExpression: string;
    groupByColumns: string | string[];
    whereConditions?: [string, string][];
  }): string {
    const { table, selectExpression, groupByColumns, whereConditions } = params;

    const builder = this.query().selectRaw(selectExpression).from(table);

    if (whereConditions) {
      const clause = this.buildWhereClause(whereConditions);
      builder.where(clause);
    }

    builder.groupBy(groupByColumns);

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
  buildVariantParseQuery(params: VariantParseQueryParams): string {
    const {
      table,
      selectColumns,
      variantColumn,
      variantSchema,
      exceptColumns,
      whereClause,
      orderBy,
      limit,
      offset,
    } = params;

    const builder = this.variantQuery().from(table).select(selectColumns);

    // Handle both single and multiple VARIANT columns
    const columns = Array.isArray(variantColumn) ? variantColumn : [variantColumn];
    const schemas = Array.isArray(variantSchema) ? variantSchema : [variantSchema];

    if (columns.length !== schemas.length) {
      throw new Error("variantColumn and variantSchema arrays must have the same length");
    }

    columns.forEach((col, i) => {
      builder.parseVariant(col, schemas[i], `parsed_${col}`);
    });

    if (exceptColumns && exceptColumns.length > 0) {
      builder.except(exceptColumns);
    }

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
