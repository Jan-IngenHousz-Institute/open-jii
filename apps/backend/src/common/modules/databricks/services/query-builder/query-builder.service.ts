import { Injectable } from "@nestjs/common";

import type { Result } from "../../../../utils/fp-utils";
import { AppError, failure, success } from "../../../../utils/fp-utils";
import { hasAggregationContent, wrapWithAggregation } from "./expressions/aggregation";
import { SqlQueryBuilder, VariantQueryBuilder } from "./query-builder.base";
import type { AsOfJoin, CountQueryParams, QueryParams } from "./query-builder.types";
import { QueryBuilderInputError } from "./query-builder.types";

/**
 * Domain-agnostic SQL builder for Databricks. Composes filters, variant
 * flattening, aggregation, and pagination via fluent builders.
 */
@Injectable()
export class QueryBuilderService {
  query(columnNames?: string[]): SqlQueryBuilder {
    return new SqlQueryBuilder(columnNames);
  }

  variantQuery(columnNames?: string[]): VariantQueryBuilder {
    return new VariantQueryBuilder(columnNames);
  }

  buildQuery(params: QueryParams): Result<string> {
    try {
      const query = params.join ? this.joinedQuery(params, params.join) : params;
      if (!hasAggregationContent(query.aggregation)) {
        return success(
          query.variants && query.variants.length > 0
            ? this.buildVariantSelectQuery(query)
            : this.buildSelectQuery(query),
        );
      }

      // Aggregation: build the inner with filters baked in so filtering
      // happens pre-aggregation. Drop ordering/limit from the inner; the
      // outer wrapper applies them on aggregated columns.
      const innerParams: QueryParams = {
        ...query,
        ordering: undefined,
        limit: undefined,
        offset: undefined,
        aggregation: undefined,
      };
      const innerSql =
        query.variants && query.variants.length > 0
          ? this.buildVariantSelectQuery(innerParams)
          : this.buildSelectQuery(innerParams);

      return success(
        wrapWithAggregation(innerSql, {
          columnNames: query.columnNames,
          aggregation: query.aggregation,
          ordering: query.ordering,
          limit: query.limit,
          offset: query.offset,
        }),
      );
    } catch (error) {
      if (error instanceof QueryBuilderInputError) {
        return failure(AppError.badRequest(error.message, "INVALID_QUERY_INPUT"));
      }
      throw error;
    }
  }

  private joinedQuery(params: QueryParams, join: AsOfJoin): QueryParams {
    if (
      !Number.isSafeInteger(join.toleranceMinutes) ||
      join.toleranceMinutes < 0 ||
      join.toleranceMinutes > Math.floor(Number.MAX_SAFE_INTEGER / 60_000_000)
    ) {
      throw new QueryBuilderInputError(
        "Tolerance must be a nonnegative whole number of minutes within the safe interval range",
      );
    }
    const {
      columns,
      filters,
      aggregation,
      ordering,
      limit,
      offset,
      distinct,
      join: _join,
      ...primary
    } = params;
    const primaryNames = new Set(join.primaryColumns);
    const isPrimary = (column: string) =>
      primaryNames.has(column) || join.primaryColumns.some((name) => column.startsWith(`${name}.`));
    const primaryFilters = filters?.filter((filter) => isPrimary(filter.column));
    const secondaryFilters = filters?.filter((filter) => !isPrimary(filter.column));
    const base = this.buildQuery({
      ...primary,
      columnNames: join.primaryColumns,
      filters: primaryFilters,
    });
    const second = this.buildQuery({
      ...join.secondary,
      columnNames: join.secondaryColumns.map((column) => column.name),
    });
    if (base.isFailure()) throw new QueryBuilderInputError(base.error.message);
    if (second.isFailure()) throw new QueryBuilderInputError(second.error.message);
    const builder = this.query();
    const quoteName = (name: string) => builder.quoteName(name);
    const p = (name: string) => `p.${quoteName(name)}`;
    const s = (name: string) => `s.${quoteName(name)}`;
    const time = (expression: string, rawType: string) => {
      const type = rawType.toUpperCase();
      if (type === "TIMESTAMP") return expression;
      if (type !== "TIMESTAMP_NTZ" && type !== "DATE") {
        throw new QueryBuilderInputError("Time matching requires a timestamp or date column");
      }
      // DATE and NTZ carry no zone. Build a UTC instant without the session's implicit cast.
      return `make_timestamp(year(${expression}), month(${expression}), day(${expression}), ${type === "DATE" ? "0, 0, 0" : `hour(${expression}), minute(${expression}), date_part('SECOND', ${expression})`}, 'UTC')`;
    };
    const primaryTime = time(p(join.primaryTimeColumn), join.primaryTimeType);
    const secondaryTime = time(s(join.secondaryTimeColumn), join.secondaryTimeType);
    const used = new Set(
      [...join.primaryColumns, ...join.secondaryColumns.map((c) => c.alias)].map((name) =>
        name.toLowerCase(),
      ),
    );
    const unique = (base: string) => {
      let name = base;
      while (used.has(name.toLowerCase())) name += "_";
      used.add(name.toLowerCase());
      return name;
    };
    const occurrence = unique("__asof_row");
    const rank = unique("__asof_rank");
    const outputs = [...join.primaryColumns, ...join.secondaryColumns.map((c) => c.alias)];
    const projection = [
      ...join.primaryColumns.map(p),
      ...join.secondaryColumns.map((c) => `${s(c.name)} AS ${quoteName(c.alias)}`),
    ];
    // Row ids can repeat. This query-local identity preserves even identical primary occurrences.
    const sql = `SELECT ${outputs.map(quoteName).join(", ")}
FROM (
  SELECT ${projection.join(", ")},
    ROW_NUMBER() OVER (PARTITION BY ${p("id")}, ${p(occurrence)} ORDER BY ${secondaryTime} DESC, ${s("id")} ASC) AS ${quoteName(rank)}
  FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY ${quoteName("id")} ORDER BY ${quoteName("id")}) AS ${quoteName(occurrence)} FROM (${base.value}) primary_input) p
  LEFT JOIN (${second.value}) s
    ON ${p(join.matchColumn)} = ${s(join.matchColumn)}
    AND ${secondaryTime} <= ${primaryTime}
    AND ${secondaryTime} >= ${primaryTime} - INTERVAL '${join.toleranceMinutes}' MINUTE
) matched
WHERE ${quoteName(rank)} = 1`;
    return {
      table: `(${sql}) joined_data`,
      columnNames: outputs,
      columns,
      filters: secondaryFilters,
      aggregation,
      ordering,
      limit,
      offset,
      distinct,
    };
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
      ordering,
      limit,
      offset,
    } = params;

    const builder = this.query(params.columnNames).from(table).select(columns);

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

    if (ordering) {
      builder.orderBy(ordering);
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
      reservedColumns = [],
      exceptColumns,
      whereClause,
      whereConditions,
      filters,
      distinct,
      ordering,
      limit,
      offset,
    } = params;

    const builder = this.variantQuery(params.columnNames)
      .from(table)
      .select(columns)
      .reserve(reservedColumns);

    if (distinct) {
      builder.distinct();
    }

    variants.forEach(({ columnName, schema, suffix }) => {
      builder.parseVariant(columnName, schema, suffix);
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

    // A filter on a flattened field compares its extraction expression, so every filter shares
    // the one WHERE with the base conditions.
    if (filters && filters.length > 0) {
      for (const filter of filters) builder.filter(filter);
    }

    if (ordering) {
      builder.orderBy(ordering);
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
