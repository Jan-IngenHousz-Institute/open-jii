import { Injectable } from "@nestjs/common";

import type { Result } from "../../../../utils/fp-utils";
import { AppError, failure, success } from "../../../../utils/fp-utils";
import { hasAggregationContent, wrapWithAggregation } from "./expressions/aggregation";
import { SqlQueryBuilder, VariantQueryBuilder } from "./query-builder.base";
import type { CountQueryParams, QueryParams } from "./query-builder.types";
import { QueryBuilderInputError } from "./query-builder.types";

/**
 * Domain-agnostic SQL builder for Databricks. Composes filters, variant
 * flattening, aggregation, and pagination via fluent builders.
 */
@Injectable()
export class QueryBuilderService {
  query(): SqlQueryBuilder {
    return new SqlQueryBuilder();
  }

  variantQuery(): VariantQueryBuilder {
    return new VariantQueryBuilder();
  }

  buildQuery(params: QueryParams): Result<string> {
    try {
      if (!hasAggregationContent(params.aggregation)) {
        return success(
          params.variants && params.variants.length > 0
            ? this.buildVariantSelectQuery(params)
            : this.buildSelectQuery(params),
        );
      }

      // Aggregation: build the inner with filters baked in so filtering
      // happens pre-aggregation. Drop orderBy/limit from the inner; the
      // outer wrapper applies them on aggregated columns.
      const innerParams: QueryParams = {
        ...params,
        orderBy: undefined,
        orderDirection: undefined,
        limit: undefined,
        offset: undefined,
        aggregation: undefined,
      };
      const innerSql =
        params.variants && params.variants.length > 0
          ? this.buildVariantSelectQuery(innerParams)
          : this.buildSelectQuery(innerParams);

      return success(
        wrapWithAggregation(innerSql, {
          aggregation: params.aggregation,
          orderBy: params.orderBy,
          orderDirection: params.orderDirection,
          limit: params.limit,
          offset: params.offset,
        }),
      );
    } catch (error) {
      if (error instanceof QueryBuilderInputError) {
        return failure(AppError.badRequest(error.message, "INVALID_QUERY_INPUT"));
      }
      throw error;
    }
  }

  /** Legacy COUNT(*) builder; prefer composing query() directly. */
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

  private buildSelectQuery(params: QueryParams): string {
    const {
      table,
      columns,
      exceptColumns,
      whereClause,
      whereConditions,
      filters,
      distinct,
      orderBy,
      orderDirection,
      limit,
      offset,
    } = params;

    const builder = this.query().from(table).select(columns);

    if (distinct) {
      builder.distinct();
    }

    if (exceptColumns && exceptColumns.length > 0) {
      builder.except(exceptColumns);
    }

    if (whereClause) {
      builder.where(whereClause);
    } else if (whereConditions) {
      const clause = builder.buildWhereClause(whereConditions);
      builder.where(clause);
    }

    if (filters && filters.length > 0) {
      for (const filter of filters) builder.filter(filter);
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

  private buildVariantSelectQuery(params: QueryParams): string {
    const {
      table,
      columns,
      variants = [],
      exceptColumns,
      whereClause,
      whereConditions,
      filters,
      orderBy,
      orderDirection,
      limit,
      offset,
    } = params;

    const builder = this.variantQuery().from(table).select(columns);

    variants.forEach(({ columnName, schema }) => {
      builder.parseVariant(columnName, schema, `parsed_${columnName}`);
    });

    if (exceptColumns && exceptColumns.length > 0) {
      builder.except(exceptColumns);
    }

    if (whereClause) {
      builder.where(whereClause);
    } else if (whereConditions) {
      const clause = builder.buildWhereClause(whereConditions);
      builder.where(clause);
    }

    // Variant builder's `.filter()` knows about the parseVariant schemas
    // it received above, so flattened-field filters land in the post-
    // flatten WHERE while base-column filters stay at the inner level.
    if (filters && filters.length > 0) {
      for (const filter of filters) builder.filter(filter);
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
}
