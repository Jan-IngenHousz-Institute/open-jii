import { aggregateKind } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { isNumericType } from "@repo/api/transforms/column-type-utils";

import {
  buildAggregation,
  isCumsumCappable,
} from "../../../databricks/services/query-builder/expressions/aggregation";
import type { AggregationOutput } from "../../../databricks/services/query-builder/expressions/aggregation";
import type {
  AggregateExpression,
  AggregationSpec,
  GroupByExpression,
  QueryOrdering,
  WidthBucket,
} from "../../../databricks/services/query-builder/query-builder.types";
import { QueryBuilderInputError } from "../../../databricks/services/query-builder/query-builder.types";
import { StoreQueryBuilder } from "./store-query-builder";
import type { FirstRows, FirstRowsTerm, StoreOutputColumn } from "./store-query-builder";

/** A decimal's precision and scale, as Spark types its arithmetic. */
type Decimal = [number, number];

const MAX_PRECISION = 38;

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
    // The shared cap keeps the first rows in the windows' order; the store finds them by key
    // first, so it never extracts every row's payload to choose them.
    const firstRows = this.firstRows(inner, page.ordering);
    if (firstRows !== undefined && page.limit !== undefined) {
      this.rows.keepFirst(firstRows, page.limit + (page.offset ?? 0));
    }
    const names = inner.map(({ name }) => name);
    const dialect = new StoreQueryBuilder(names).over(inner);
    dialect.followIds(page.idOrder);

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
   * The rows the shared cap keeps, when every window looks back in one order. A tie breaker sorts
   * nulls last, as the store's plain ASC in the window does.
   */
  private firstRows(inner: StoreOutputColumn[], ordering?: QueryOrdering): FirstRows | undefined {
    const hasGroups = (this.aggregation.groupBy ?? []).length > 0;
    if (hasGroups) {
      return undefined;
    }

    const orders = (this.aggregation.functions ?? []).map((item): FirstRowsTerm[] | undefined => {
      if (item.function === "cumsum") {
        return isCumsumCappable(ordering)
          ? [{ column: ordering.column, nulls: "FIRST" }]
          : undefined;
      }
      if (aggregateKind(item.function) !== "rowWindow" || item.orderColumn === undefined) {
        return undefined;
      }
      const order: FirstRowsTerm = { column: item.orderColumn, nulls: "LAST" };
      const tie = item.tieBreaker;
      return tie !== undefined && tie !== item.orderColumn
        ? [order, { column: tie, nulls: "LAST" }]
        : [order];
    });

    const isPlainValue = (column: string) =>
      inner.some((candidate) => candidate.name === column && candidate.idOf === undefined);
    const keys = new Set(orders.map((order) => JSON.stringify(order)));
    const [order] = orders;
    const isOneOrder =
      keys.size === 1 && (order?.every(({ column }) => isPlainValue(column)) ?? false);
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
      return { name, type: this.widthBucketType(type, item.widthBucket) };
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

  /**
   * Spark divides whole numbers as doubles, whose floor is a BIGINT, but reads a literal with a
   * fraction as a DECIMAL, which keeps the division decimal and its floor a DECIMAL of scale 0.
   */
  private widthBucketType(columnType: string, bucket: WidthBucket): string {
    // A time is its epoch milliseconds, a BIGINT.
    const position = this.wholeColumn(bucket.scale === "time" ? "BIGINT" : columnType);
    const origin = this.literalDecimal(bucket.origin);
    const width = this.literalDecimal(bucket.width);
    const isDouble = position === undefined || origin === undefined || width === undefined;
    if (isDouble || (origin[1] === 0 && width[1] === 0)) {
      return "BIGINT";
    }

    const difference = this.subtracted(position, origin);
    const [precision, scale] = this.divided(difference, width);
    return `DECIMAL(${Math.min(precision - scale + 1, MAX_PRECISION)},0)`;
  }

  private wholeColumn(type: string): Decimal | undefined {
    if (type === "BIGINT") {
      return [20, 0];
    }
    return type === "INT" ? [10, 0] : undefined;
  }

  private integerDecimal(value: number): Decimal {
    return Math.abs(value) <= 2_147_483_647 ? [10, 0] : [20, 0];
  }

  /** None for a literal Spark reads as a double, which it writes with an exponent. */
  private literalDecimal(value: number): Decimal | undefined {
    const text = String(value);
    if (/e/i.test(text)) {
      return undefined;
    }
    const [whole, fraction = ""] = text.replace("-", "").split(".");
    if (fraction === "") {
      return this.integerDecimal(value);
    }
    const digits = whole.replace(/^0+/, "").length + fraction.length;
    return [Math.max(digits, fraction.length), fraction.length];
  }

  private subtracted([p1, s1]: Decimal, [p2, s2]: Decimal): Decimal {
    const isWhole = s1 === 0 && s2 === 0;
    if (isWhole) {
      return [Math.max(p1, p2), 0];
    }
    const scale = Math.max(s1, s2);
    return this.bounded(Math.max(p1 - s1, p2 - s2) + scale + 1, scale);
  }

  private divided([p1, s1]: Decimal, [p2, s2]: Decimal): Decimal {
    const scale = Math.max(6, s1 + p2 + 1);
    return this.bounded(p1 - s1 + s2 + scale, scale);
  }

  /** Spark keeps the whole digits of a result past 38 and gives up scale, down to 6. */
  private bounded(precision: number, scale: number): Decimal {
    if (precision <= MAX_PRECISION) {
      return [precision, scale];
    }
    const wholeDigits = precision - scale;
    return [MAX_PRECISION, Math.max(MAX_PRECISION - wholeDigits, Math.min(scale, 6))];
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
