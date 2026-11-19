import { aggregateKind } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { isNumericType } from "@repo/api/transforms/column-type-utils";

import { buildAggregation } from "../../../databricks/services/query-builder/expressions/aggregation";
import type { AggregationOutput } from "../../../databricks/services/query-builder/expressions/aggregation";
import type {
  AggregateExpression,
  AggregationSpec,
  GroupByExpression,
  QueryOrdering,
} from "../../../databricks/services/query-builder/query-builder.types";
import { QueryBuilderInputError } from "../../../databricks/services/query-builder/query-builder.types";
import { SparkWidthBucket } from "./spark-width-bucket";
import { StoreQueryBuilder } from "./store-query-builder";
import type { FirstRows, StoreOutputColumn } from "./store-query-builder";

/**
 * A chart's grouping and aggregates over a store read, written by the warehouse's own wrapper in
 * the store's dialect, with each output typed as Spark types it so its cells read alike.
 */
export class StoreAggregation {
  constructor(
    private readonly rows: StoreQueryBuilder,
    private readonly aggregation: AggregationSpec,
  ) {}

  build(page: { ordering?: QueryOrdering; limit?: number; offset?: number; idOrder?: string[] }): {
    sql: string;
    columns: StoreOutputColumn[];
  } {
    if (this.aggregation.explode !== undefined) {
      throw new QueryBuilderInputError("The store does not expand arrays into rows");
    }

    const inner = this.rows.outputColumns().map(({ name, type, idOf }) => ({ name, type, idOf }));
    // The store finds a capped read's rows by key first, so it never extracts every row's payload
    // to choose them.
    const firstRows = this.firstRows(inner, page.ordering);
    if (firstRows !== undefined && page.limit !== undefined) {
      this.rows.keepFirst(firstRows, page.limit + (page.offset ?? 0));
    }
    const names = inner.map(({ name }) => name);
    const dialect = new StoreQueryBuilder(names).over(inner);
    dialect.followIds(page.idOrder);
    dialect.typesOutputs(
      (output) => this.outputColumns(output, inner).find(({ name }) => name === output.name)?.type,
    );

    const { sql, outputs } = buildAggregation(
      this.rows.buildValues(),
      { columnNames: names, aggregation: this.aggregation, ...page },
      dialect,
    );
    const columns = outputs.flatMap((output) => this.outputColumns(output, inner));
    const cells = columns.map(({ name, type }) => {
      const quoted = dialect.quoteName(name);
      return dialect.isIntegerType(type) ? `toString(${quoted}) AS ${quoted}` : quoted;
    });
    // The outer statement keeps the aggregate's order; under prefer_column_name_to_alias each text
    // conversion reads the inner column, not its own alias.
    return { sql: dialect.buildOver(`SELECT ${cells.join(", ")} FROM (${sql})`), columns };
  }

  /**
   * The rows a read may stop at before its windows run: only where it shows its rows going up in
   * the order every window looks back in, so the rows it keeps hold each kept row's earlier rows
   * and every window reads as over every row. A running sum adds in the rows tied with it, so its
   * cut keeps every row tied with the last.
   */
  private firstRows(inner: StoreOutputColumn[], ordering?: QueryOrdering): FirstRows | undefined {
    const hasGroups = (this.aggregation.groupBy ?? []).length > 0;
    const isGoingUp = ordering !== undefined && ordering.direction !== "DESC";
    if (hasGroups || !isGoingUp) {
      return undefined;
    }

    const orders = (this.aggregation.functions ?? []).map((item): string[] | undefined => {
      if (item.function === "cumsum") {
        return [ordering.column];
      }
      const isReadOrderWindow =
        aggregateKind(item.function) === "rowWindow" && item.orderColumn === ordering.column;
      if (!isReadOrderWindow) {
        return undefined;
      }
      const tie = item.tieBreaker;
      return tie !== undefined && tie !== ordering.column
        ? [ordering.column, tie]
        : [ordering.column];
    });

    const isPlainValue = (column: string) =>
      inner.some((candidate) => candidate.name === column && candidate.idOf === undefined);
    const keys = new Set(orders.map((order) => JSON.stringify(order)));
    const [order] = orders;
    const isOneOrder = keys.size === 1 && (order?.every(isPlainValue) ?? false);
    const hasRunningSum = (this.aggregation.functions ?? []).some(
      (item) => item.function === "cumsum",
    );
    return isOneOrder && order !== undefined ? { order, withTies: hasRunningSum } : undefined;
  }

  private outputColumns(
    output: AggregationOutput,
    inner: StoreOutputColumn[],
  ): StoreOutputColumn[] {
    if (output.kind === "rows") {
      return inner;
    }
    if (output.kind === "group") {
      return [this.groupOutput(output.item, output.name, inner)];
    }
    return [this.functionOutput(output.item, output.name, inner)];
  }

  private groupOutput(
    item: GroupByExpression,
    name: string,
    inner: StoreOutputColumn[],
  ): StoreOutputColumn {
    if (item.timeBucket !== undefined) {
      return { name, type: "TIMESTAMP" };
    }
    if (item.widthBucket !== undefined) {
      const { type } = this.columnOf(inner, item.column);
      return { name, type: new SparkWidthBucket(type, item.widthBucket).type };
    }
    return { ...this.columnOf(inner, item.column), name };
  }

  /** Spark's result type for each function: a count is a BIGINT, a mean or a spread a DOUBLE, a
   *  sum keeps whole numbers whole, and a picked value keeps its column's type. */
  private functionOutput(
    item: AggregateExpression,
    name: string,
    inner: StoreOutputColumn[],
  ): StoreOutputColumn {
    const column = item.column === "*" ? undefined : this.columnOf(inner, item.column);
    const isWhole = column !== undefined && this.rows.isIntegerType(column.type);

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
