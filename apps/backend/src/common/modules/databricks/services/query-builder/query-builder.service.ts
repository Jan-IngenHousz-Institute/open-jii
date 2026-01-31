import { Injectable } from "@nestjs/common";

import { SqlQueryBuilder, VariantQueryBuilder } from "./query-builder.base";
import type { CountQueryParams, QueryParams } from "./query-builder.types";

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
   * Create a new SQL query builder
   */
  query(): SqlQueryBuilder {
    return new SqlQueryBuilder();
  }

  /**
   * Create a new VARIANT query builder
   */
  variantQuery(): VariantQueryBuilder {
    return new VariantQueryBuilder();
  }

  /**
   * Build a SQL query with optional VARIANT parsing, WHERE, ORDER BY, LIMIT, and OFFSET.
   * Automatically handles both simple SELECT and VARIANT parsing based on variants parameter.
   *
   * @param params.table - Fully qualified table name
   * @param params.columns - Columns to select (e.g., ["id", "timestamp"] or ["*"])
   * @param params.variants - Optional VARIANT columns with schemas for parsing
   * @param params.exceptColumns - Optional columns to exclude from result
   * @param params.whereClause - Optional WHERE clause string
   * @param params.whereConditions - Optional WHERE conditions as [column, value] tuples
   * @param params.orderBy - Optional ORDER BY column
   * @param params.orderDirection - Optional sort direction (ASC/DESC)
   * @param params.limit - Optional LIMIT
   * @param params.offset - Optional OFFSET
   */
  buildQuery(params: QueryParams): string {
    if (params.variants && params.variants.length > 0) {
      return this.buildVariantSelectQuery({
        table: params.table,
        columns: params.columns ?? ["*"],
        variants: params.variants,
        exceptColumns: params.exceptColumns,
        whereClause: params.whereClause,
        orderBy: params.orderBy,
        limit: params.limit,
        offset: params.offset,
      });
    } else {
      return this.buildSelectQuery({
        table: params.table,
        columns: params.columns ?? ["*"],
        whereClause: params.whereClause,
        whereConditions: params.whereConditions,
        orderBy: params.orderBy,
        orderDirection: params.orderDirection,
        limit: params.limit,
        offset: params.offset,
      });
    }
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
      const clause = builder.buildWhereClause(whereConditions);
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
      const clause = builder.buildWhereClause(whereConditions);
      builder.where(clause);
    }

    builder.groupBy(groupByColumns);

    return builder.build();
  }

  /**
   * Build a SELECT query with optional WHERE, ORDER BY, LIMIT, and OFFSET
   */
  private buildSelectQuery(params: QueryParams): string {
    const { table, columns, whereClause, whereConditions, orderBy, orderDirection, limit, offset } =
      params;

    const builder = this.query().from(table).select(columns);

    if (whereClause) {
      builder.where(whereClause);
    } else if (whereConditions) {
      const clause = builder.buildWhereClause(whereConditions);
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
   * Build a SQL query to parse VARIANT column using provided schema.
   *
   * Pattern:
   * 1. Parse VARIANT using from_json(variantColumn::string, schema)
   * 2. Expand all fields with parsed_output.*
   *
   * @param params.table - Fully qualified table name (catalog.schema.table)
   * @param params.columns - Base columns to select (e.g., ["id", "timestamp"] or ["*"])
   * @param params.variants - VARIANT columns with their schemas to parse
   * @param params.whereClause - Optional WHERE clause
   * @param params.orderBy - Optional ORDER BY clause
   * @param params.limit - Optional LIMIT
   * @param params.offset - Optional OFFSET
   */
  private buildVariantSelectQuery(params: QueryParams): string {
    const {
      table,
      columns = ["*"],
      variants = [],
      exceptColumns,
      whereClause,
      orderBy,
      limit,
      offset,
    } = params;

    const builder = this.variantQuery().from(table).select(columns);

    // Parse each VARIANT column with its schema
    variants.forEach(({ columnName, schema }) => {
      builder.parseVariant(columnName, schema, `parsed_${columnName}`);
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
