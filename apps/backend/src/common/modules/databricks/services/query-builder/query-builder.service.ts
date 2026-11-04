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
    const rowAggregation =
      (aggregation?.groupBy?.length ?? 0) > 0 ||
      aggregation?.functions?.some((fn) => fn.function !== "cumsum");
    const allNames = new Set([
      ...join.primaryColumns,
      ...join.secondaryColumns.map((column) => column.alias),
    ]);
    const references = [
      ...(columns ?? []),
      ...(secondaryFilters?.map((filter) => filter.column) ?? []),
      ...(ordering ? [ordering.column] : []),
      ...(aggregation?.groupBy?.map((group) => group.column) ?? []),
      ...(aggregation?.functions?.flatMap((fn) => [
        fn.column,
        ...(fn.secondColumn ? [fn.secondColumn] : []),
      ]) ?? []),
      ...(aggregation?.explode ? [aggregation.explode.column] : []),
    ];
    const selectedSecondary =
      !columns?.length && !rowAggregation
        ? join.secondaryColumns
        : join.secondaryColumns.filter((column) =>
            references.some(
              (reference) =>
                reference === column.alias ||
                (!allNames.has(reference) && reference.startsWith(`${column.alias}.`)),
            ),
          );
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
    const key = unique("__asof_key");
    const at = unique("__asof_time");
    const kind = unique("__asof_kind");
    const tie = unique("__asof_tie");
    const primaryRow = unique("__asof_primary");
    const secondaryRow = unique("__asof_secondary");
    const latest = unique("__asof_latest");
    const struct = (names: string[], reference: (name: string) => string) =>
      `named_struct(${names.map((name) => `${builder.escapeValue(name)}, ${reference(name)}`).join(", ")})`;
    const outputs = [...join.primaryColumns, ...join.secondaryColumns.map((c) => c.alias)];
    const withinTolerance = `${quoteName(latest)}.at >= ${quoteName(at)} - INTERVAL '${join.toleranceMinutes}' MINUTE`;
    const projection = [
      ...join.primaryColumns.map(
        (name) => `${quoteName(primaryRow)}.${quoteName(name)} AS ${quoteName(name)}`,
      ),
      ...selectedSecondary.map(
        (c) =>
          `CASE WHEN ${withinTolerance} THEN ${quoteName(latest)}.data.${quoteName(c.name)} END AS ${quoteName(c.alias)}`,
      ),
    ];
    // Carry one secondary row through a sorted timeline instead of expanding all candidate pairs.
    // Secondary events precede primary events at the same instant; the lowest id wins a tie.
    const sql = `SELECT ${projection.join(", ")}
FROM (
  SELECT *, LAST_VALUE(${quoteName(secondaryRow)}, true) OVER (
    PARTITION BY ${quoteName(key)}
    ORDER BY ${quoteName(at)}, ${quoteName(kind)}, ${quoteName(tie)} DESC NULLS LAST
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS ${quoteName(latest)}
  FROM (
    SELECT ${p(join.matchColumn)} AS ${quoteName(key)}, ${primaryTime} AS ${quoteName(at)},
      1 AS ${quoteName(kind)}, NULL AS ${quoteName(tie)},
      ${struct(join.primaryColumns, p)} AS ${quoteName(primaryRow)}, NULL AS ${quoteName(secondaryRow)}
    FROM (${base.value}) p
    UNION ALL
    SELECT ${s(join.matchColumn)} AS ${quoteName(key)}, ${secondaryTime} AS ${quoteName(at)},
      0 AS ${quoteName(kind)}, ${s("id")} AS ${quoteName(tie)},
      NULL AS ${quoteName(primaryRow)},
      named_struct('at', ${secondaryTime}, 'data', ${
        selectedSecondary.length
          ? struct(
              selectedSecondary.map((c) => c.name),
              s,
            )
          : "NULL"
      }) AS ${quoteName(secondaryRow)}
    FROM (${second.value}) s
    WHERE ${s(join.matchColumn)} IS NOT NULL AND ${secondaryTime} IS NOT NULL
  ) events
) carried
WHERE ${quoteName(kind)} = 1`;
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
