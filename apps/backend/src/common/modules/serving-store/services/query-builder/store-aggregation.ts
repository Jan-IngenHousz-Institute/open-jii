import { aggregateKind } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { isNumericType } from "@repo/api/transforms/column-type-utils";

import {
  buildAggregation,
  keepsEveryRow,
} from "../../../databricks/services/query-builder/expressions/aggregation";
import type { NamedOutput } from "../../../databricks/services/query-builder/expressions/aggregation";
import type {
  AggregateExpression,
  AggregationSpec,
  GroupByExpression,
  QueryOrdering,
} from "../../../databricks/services/query-builder/query-builder.types";
import { QueryBuilderInputError } from "../../../databricks/services/query-builder/query-builder.types";
import { SparkDecimal } from "./spark-decimal";
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

  build({
    columns: named,
    idOrder,
    ...page
  }: {
    ordering?: QueryOrdering;
    limit?: number;
    offset?: number;
    idOrder?: string[][];
    /** The columns a read that keeps its rows returns beside its windows. */
    columns?: string[];
  }): {
    sql: string;
    columns: StoreOutputColumn[];
  } {
    if (this.aggregation.explode !== undefined) {
      throw new QueryBuilderInputError("The store does not expand arrays into rows");
    }

    // Only the columns the read uses leave the table, so a wide table's other payload fields and
    // sheets stay out of the statement, whose text the store caps, and out of the store's work.
    this.rows.select(this.inputs(named, page.ordering));
    const inner = this.rows.outputColumns().map(({ name, type, idOf, isPairText, isArray }) => ({
      name,
      type,
      idOf,
      isPairText,
      isArray,
    }));

    // The store finds a capped read's rows by key first, so it never extracts every row's payload
    // to choose them.
    const firstRows = this.firstRows(inner, page.ordering);
    if (firstRows !== undefined && page.limit !== undefined) {
      this.rows.keepFirst(firstRows, page.limit + (page.offset ?? 0));
    }

    const names = inner.map(({ name }) => name);
    const dialect = new StoreQueryBuilder(names).over(inner);
    dialect.idOrder(idOrder);
    dialect.outputTypes(
      (output) => this.outputColumns(output, inner).find(({ name }) => name === output.name)?.type,
    );

    const { sql, outputs } = buildAggregation(
      this.rows.buildValues(),
      {
        columnNames: names,
        aggregation: this.aggregation,
        ...page,
        ordering: this.groupOrdering(page.ordering),
      },
      dialect,
    );

    const cells = outputs.flatMap((output) =>
      output.kind === "rows"
        ? this.shownRows(inner, dialect, named)
        : this.outputColumns(output, inner).map((column) => ({
            column,
            sql: dialect.quoteName(column.name),
          })),
    );
    // The outer statement keeps the aggregate's order; under prefer_column_name_to_alias each text
    // conversion reads the inner column, not its own alias.
    const projection = cells.map(({ column, sql: source }) => this.cell(dialect, column, source));
    return {
      sql: dialect.buildOver(`SELECT ${projection.join(", ")} FROM (${sql})`),
      columns: cells.map(({ column }) => column),
    };
  }

  /** Integers leave as text, and decimals as text at their scale, as a page's do, since a JSON
   *  number would pass through a double. */
  private cell(dialect: StoreQueryBuilder, { name, type }: StoreOutputColumn, sql: string): string {
    const quoted = dialect.quoteName(name);
    const decimal = SparkDecimal.of(type);
    if (decimal !== null) {
      return `toDecimalString(${sql}, ${decimal.scale}) AS ${quoted}`;
    }
    if (dialect.isIntegerType(type)) {
      return `toString(${sql}) AS ${quoted}`;
    }
    return sql === quoted ? quoted : `${sql} AS ${quoted}`;
  }

  /**
   * A sort by a renamed group's own column, as a sort by the group's output: the store sorts around
   * the aggregate, where only the outputs have names, and Spark sorts such a read by the group.
   */
  private groupOrdering(ordering?: QueryOrdering): QueryOrdering | undefined {
    const renamed = (this.aggregation.groupBy ?? []).find(
      ({ column, alias, timeBucket, widthBucket }) =>
        column === ordering?.column &&
        alias !== undefined &&
        timeBucket === undefined &&
        widthBucket === undefined,
    );
    return ordering === undefined || renamed?.alias === undefined
      ? ordering
      : { ...ordering, column: renamed.alias };
  }

  /**
   * The columns the read's groups, functions and sort read, and those it shows beside its windows,
   * a contributor or a device whole where it names a path into one. A read that keeps its rows and
   * names no columns shows every one; a read that counts rows alone still reads one.
   */
  private inputs(named: string[] = [], ordering?: QueryOrdering): string[] | undefined {
    const groups = this.aggregation.groupBy ?? [];
    const functions = this.aggregation.functions ?? [];
    const keepsRows = keepsEveryRow(this.aggregation);
    const shown = named.filter((name) => name.length > 0 && name !== "*");
    if (keepsRows && shown.length === 0) {
      return undefined;
    }

    const available = this.rows.outputColumns().map(({ name }) => name);
    const referenced = [
      ...groups.map(({ column }) => column),
      ...functions.flatMap((item) => [
        item.column,
        item.secondColumn,
        item.partitionColumn,
        item.orderColumn,
        item.tieBreaker,
      ]),
      ordering?.column,
      ...(keepsRows ? shown : []),
    ];
    const inputs = referenced.flatMap((name) => {
      if (name === undefined) {
        return [];
      }
      const owner = available
        .filter((column) => column === name || name.startsWith(`${column}.`))
        .sort((a, b) => b.length - a.length)
        .at(0);
      return owner === undefined ? [] : [owner];
    });
    return inputs.length > 0 ? [...new Set(inputs)] : available.slice(0, 1);
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

  /**
   * The columns rows kept whole return beside their windows: those the chart names, in its order
   * and as the warehouse returns them, or every one where it names none, never a wide table's
   * every column. A path into a contributor or a device reads its field, under the field's name,
   * as Spark names it.
   */
  private shownRows(
    inner: StoreOutputColumn[],
    dialect: StoreQueryBuilder,
    named: string[] = [],
  ): { column: StoreOutputColumn; sql: string }[] {
    const names = [...new Set(named)].filter((name) => name.length > 0 && name !== "*");
    if (names.length === 0) {
      return inner.map((column) => ({ column, sql: dialect.quoteName(column.name) }));
    }
    return names.map((name) => {
      const own = inner.find((column) => column.name === name);
      if (own !== undefined) {
        return { column: own, sql: dialect.quoteName(name) };
      }
      const field = name.slice(name.lastIndexOf(".") + 1);
      return { column: { name: field, type: "STRING" }, sql: dialect.rowField(name) };
    });
  }

  private outputColumns(output: NamedOutput, inner: StoreOutputColumn[]): StoreOutputColumn[] {
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

  /** Spark's result type for each function: a count is a BIGINT, a spread a DOUBLE, a sum keeps
   *  whole numbers whole, a sum, a mean and a difference of decimals are wider decimals, and a
   *  picked value keeps its column's type. */
  private functionOutput(
    item: AggregateExpression,
    name: string,
    inner: StoreOutputColumn[],
  ): StoreOutputColumn {
    const column = item.column === "*" ? undefined : this.columnOf(inner, item.column);
    const isWhole = column !== undefined && this.rows.isIntegerType(column.type);
    const decimal = column === undefined ? null : SparkDecimal.of(column.type);

    switch (item.function) {
      case "count":
      case "count_distinct":
        return { name, type: "BIGINT" };
      case "row_number":
        return { name, type: "INT" };
      case "sum":
      case "cumsum": {
        // Grouped, a running sum adds up the groups' sums, each already a SUM's type.
        const isGroupedRunningSum =
          item.function === "cumsum" && (this.aggregation.groupBy ?? []).length > 0;
        const total = isGroupedRunningSum ? decimal?.sum().sum() : decimal?.sum();
        if (total !== undefined) {
          return { name, type: total.type };
        }
        return { name, type: column === undefined || isWhole ? "BIGINT" : "DOUBLE" };
      }
      case "avg":
        return { name, type: decimal === null ? "DOUBLE" : decimal.average().type };
      case "std":
      case "var":
      case "corr":
        return { name, type: "DOUBLE" };
      case "change_from_previous": {
        if (decimal !== null) {
          return { name, type: decimal.minus(decimal).type };
        }
        const isNumber = column !== undefined && isNumericType(column.type);
        return { name, type: isNumber ? column.type : "DOUBLE" };
      }
      case "min":
      case "max":
        return { ...this.columnOf(inner, item.column), name };
      case "latest":
      case "earliest":
      case "previous": {
        // A device is picked and lagged as its key's JSON text, which can be null.
        const picked = this.columnOf(inner, item.column);
        const isDevice = picked.idOf === "device";
        return isDevice ? { ...picked, name, isPairText: true } : { ...picked, name };
      }
    }
  }

  private columnOf(inner: StoreOutputColumn[], name: string): StoreOutputColumn {
    const column = inner.find((candidate) => candidate.name === name);
    if (column !== undefined) {
      return { name, type: column.type, idOf: column.idOf, isPairText: column.isPairText };
    }
    const owner = inner.find(({ name: candidate }) => name.startsWith(`${candidate}.`));
    if (owner?.idOf === undefined) {
      throw new QueryBuilderInputError(`Unknown column '${name}'`);
    }
    return { name, type: "STRING" };
  }
}
