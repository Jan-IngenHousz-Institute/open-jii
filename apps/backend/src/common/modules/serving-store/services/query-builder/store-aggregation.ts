import { aggregateKind } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { isNumericType } from "@repo/api/transforms/column-type-utils";

import { wrapWithAggregation } from "../../../databricks/services/query-builder/expressions/aggregation";
import type {
  AggregateExpression,
  AggregationSpec,
  GroupByExpression,
  QueryOrdering,
} from "../../../databricks/services/query-builder/query-builder.types";
import { QueryBuilderInputError } from "../../../databricks/services/query-builder/query-builder.types";
import { StoreQueryBuilder } from "./store-query-builder";
import type { StoreOutputColumn } from "./store-query-builder";

/** Integers leave the store as text, since an id or a sum may pass 2^53. */
const INTEGER_TYPES = new Set(["BIGINT", "INT"]);

/**
 * A chart's grouping and aggregates over a store read, in the warehouse's statement shape: the
 * warehouse's own wrapper writes it, through the store's dialect, over the read's values. Each
 * output is typed as Spark types it, so its cells read as the warehouse's do.
 */
export class StoreAggregation {
  constructor(
    private readonly rows: StoreQueryBuilder,
    private readonly aggregation: AggregationSpec,
  ) {}

  build(page: { ordering?: QueryOrdering; limit?: number; offset?: number }): {
    sql: string;
    columns: StoreOutputColumn[];
  } {
    if (this.aggregation.explode !== undefined) {
      throw new QueryBuilderInputError("The store does not expand arrays into rows");
    }

    const inner = this.rows.outputColumns();
    const names = inner.map(({ name }) => name);
    const dialect = new StoreQueryBuilder(names).over(inner);
    const aggregated = wrapWithAggregation(
      this.rows.buildValues(),
      { columnNames: names, aggregation: this.aggregation, ...page },
      dialect,
    );

    const columns = this.outputs(dialect, inner);
    const cells = columns.map(({ name, type }) => {
      const quoted = dialect.quoteName(name);
      return INTEGER_TYPES.has(type) ? `toString(${quoted}) AS ${quoted}` : quoted;
    });
    // The statement keeps the aggregate's order; the store reads the names below an alias first.
    return { sql: `SELECT ${cells.join(", ")} FROM (${aggregated})`, columns };
  }

  /** The wrapper's outputs in its order: groups, row aggregates, then windows, or every row's
   *  columns then windows when nothing groups. */
  private outputs(dialect: StoreQueryBuilder, inner: StoreOutputColumn[]): StoreOutputColumn[] {
    const functions = this.aggregation.functions ?? [];
    const isWindow = ({ function: fn }: AggregateExpression) =>
      fn === "cumsum" || aggregateKind(fn) === "rowWindow";
    const groups = (this.aggregation.groupBy ?? []).map((item) =>
      this.groupOutput(dialect, inner, item),
    );
    const rowAggregates = functions
      .filter((item) => !isWindow(item))
      .map((item) => this.functionOutput(dialect, inner, item));
    const windows = functions
      .filter(isWindow)
      .map((item) => this.functionOutput(dialect, inner, item));

    const isWindowOnly = groups.length === 0 && rowAggregates.length === 0;
    return isWindowOnly ? [...inner, ...windows] : [...groups, ...rowAggregates, ...windows];
  }

  private groupOutput(
    dialect: StoreQueryBuilder,
    inner: StoreOutputColumn[],
    item: GroupByExpression,
  ): StoreOutputColumn {
    if (item.timeBucket !== undefined) {
      const { alias } = dialect.buildTimeBucketExpression(item.column, item.timeBucket);
      return { name: alias, type: "TIMESTAMP" };
    }
    if (item.widthBucket !== undefined) {
      const { alias } = dialect.buildWidthBucketExpression(item.column, item.widthBucket, item.alias);
      return { name: alias, type: "BIGINT" };
    }
    return { ...this.columnOf(inner, item.column), name: item.alias ?? item.column };
  }

  /** Spark's result type for each function: a count is a BIGINT, a mean or a spread a DOUBLE, a
   *  sum keeps whole numbers whole, and a picked value keeps its column's type. */
  private functionOutput(
    dialect: StoreQueryBuilder,
    inner: StoreOutputColumn[],
    item: AggregateExpression,
  ): StoreOutputColumn {
    const name = this.aliasOf(dialect, item);
    const column = item.column === "*" ? undefined : this.columnOf(inner, item.column);
    const isWhole = column !== undefined && INTEGER_TYPES.has(column.type);

    switch (item.function) {
      case "count":
      case "count_distinct":
        return { name, type: "BIGINT" };
      case "row_number":
        return { name, type: "INT" };
      case "sum":
      case "cumsum":
        return { name, type: column === undefined || isWhole ? "BIGINT" : "DOUBLE" };
      case "avg":
      case "std":
      case "var":
      case "corr":
        return { name, type: "DOUBLE" };
      case "change_from_previous": {
        const isNumber = column !== undefined && isNumericType(column.type);
        return { name, type: isNumber ? column.type : "DOUBLE" };
      }
      case "min":
      case "max":
      case "latest":
      case "earliest":
      case "previous":
        return { ...this.columnOf(inner, item.column), name };
    }
  }

  private aliasOf(dialect: StoreQueryBuilder, item: AggregateExpression): string {
    if (item.function === "cumsum") {
      return dialect.buildCumsumExpression(item, { orderBy: "", grouped: false }).alias;
    }
    if (aggregateKind(item.function) === "rowWindow") {
      return dialect.buildRowWindowExpression(item).alias;
    }
    return dialect.buildAggregateExpression(item).alias;
  }

  /** A column the read holds, or a field of a contributor or device, which is text. */
  private columnOf(inner: StoreOutputColumn[], name: string): StoreOutputColumn {
    const column = inner.find((candidate) => candidate.name === name);
    if (column !== undefined) {
      return { name, type: column.type, idOf: column.idOf };
    }
    const owner = inner.find(({ name: candidate }) => name.startsWith(`${candidate}.`));
    if (owner?.idOf === undefined) {
      throw new QueryBuilderInputError(`Unknown column '${name}'`);
    }
    return { name, type: "STRING" };
  }
}
