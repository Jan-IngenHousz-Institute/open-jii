import { SqlQueryBuilder, VariantQueryBuilder } from "./query-builder.base";
import type { TimeBucketUnit } from "./query-builder.types";
import { VariantSchema } from "./schema/variant-schema";

function duckDbEscapeIdentifier(identifier: string): string {
  return identifier
    .split(".")
    .map((part) => `"${part.replace(/"/g, '""')}"`)
    .join(".");
}

function duckDbPseudonymExpression(saltSql: string, colSql: string): string {
  // || propagates NULL like Spark concat; DuckDB's concat() skips NULLs and
  // would mint a pseudonym for a NULL contributor id.
  return `'Contributor-' || upper(substr(sha256(${saltSql} || ${colSql}), 1, 6))`;
}

function duckDbDateTruncExpression(unit: TimeBucketUnit, colSql: string): string {
  // DuckDB does not coerce VARCHAR timestamps; the cast is a no-op on real
  // ones. The session runs in UTC, so casting a TIMESTAMPTZ here yields the
  // UTC wall clock Spark buckets on.
  return `date_trunc('${unit.toLowerCase()}', CAST(${colSql} AS TIMESTAMP))`;
}

function duckDbOrderByTerm(colSql: string, direction: "ASC" | "DESC"): string {
  // DuckDB defaults NULLs last in both directions; Spark puts them first when
  // ascending. Left implicit, page 1 of an ascending sort over a nullable
  // column is a different row set per engine.
  const nulls = direction === "ASC" ? "NULLS FIRST" : "NULLS LAST";
  return `${colSql} ${direction} ${nulls}`;
}

export class DuckDbSqlQueryBuilder extends SqlQueryBuilder {
  escapeIdentifier(identifier: string): string {
    return duckDbEscapeIdentifier(identifier);
  }

  starExceptClause(columns: string[]): string {
    const list = columns.map((c) => this.escapeIdentifier(c)).join(", ");
    return `* EXCLUDE (${list})`;
  }

  pseudonymExpression(saltSql: string, colSql: string): string {
    return duckDbPseudonymExpression(saltSql, colSql);
  }

  dateTruncExpression(unit: TimeBucketUnit, colSql: string): string {
    return duckDbDateTruncExpression(unit, colSql);
  }

  orderByTerm(colSql: string, direction: "ASC" | "DESC"): string {
    return duckDbOrderByTerm(colSql, direction);
  }
}

export class DuckDbVariantQueryBuilder extends VariantQueryBuilder {
  escapeIdentifier(identifier: string): string {
    return duckDbEscapeIdentifier(identifier);
  }

  starExceptClause(columns: string[]): string {
    const list = columns.map((c) => this.escapeIdentifier(c)).join(", ");
    return `* EXCLUDE (${list})`;
  }

  pseudonymExpression(saltSql: string, colSql: string): string {
    return duckDbPseudonymExpression(saltSql, colSql);
  }

  dateTruncExpression(unit: TimeBucketUnit, colSql: string): string {
    return duckDbDateTruncExpression(unit, colSql);
  }

  orderByTerm(colSql: string, direction: "ASC" | "DESC"): string {
    return duckDbOrderByTerm(colSql, direction);
  }

  /**
   * DuckDB cast target for a Spark VARIANT-DDL field type, or null to leave
   * the extraction as a native VARIANT. Nested types take the null branch:
   * casting them (to JSON or VARCHAR) reports the column as a string, which
   * would make an unplottable nested object look categorical, whereas VARIANT
   * classifies as complex like Spark's struct does.
   */
  private static duckDbCastType(sparkType: string): string | null {
    const upper = sparkType.toUpperCase();
    if (
      upper.startsWith("OBJECT<") ||
      upper.startsWith("STRUCT<") ||
      upper.startsWith("ARRAY<") ||
      upper.startsWith("MAP<")
    ) {
      return null;
    }
    if (upper.startsWith("DECIMAL") || upper.startsWith("NUMERIC")) {
      return sparkType;
    }
    const SCALAR_TYPES: Record<string, string> = {
      STRING: "VARCHAR",
      VOID: "VARCHAR",
      BOOLEAN: "BOOLEAN",
      TINYINT: "TINYINT",
      SMALLINT: "SMALLINT",
      INT: "INTEGER",
      BIGINT: "BIGINT",
      LONG: "BIGINT",
      FLOAT: "FLOAT",
      REAL: "FLOAT",
      DOUBLE: "DOUBLE",
      DATE: "DATE",
      TIMESTAMP: "TIMESTAMP",
      TIMESTAMP_NTZ: "TIMESTAMP",
    };
    return SCALAR_TYPES[upper] ?? "VARCHAR";
  }

  /** Typed projection of one top-level variant field. */
  private fieldExtraction(column: string, field: { name: string; type: string }): string {
    const source = `variant_extract(${this.escapeIdentifier(column)}, ${this.escapeValue(field.name)})`;
    const castType = DuckDbVariantQueryBuilder.duckDbCastType(field.type);
    const projection = castType === null ? source : `try_cast(${source} AS ${castType})`;
    return `${projection} AS ${this.escapeIdentifier(field.name)}`;
  }

  /**
   * DuckDB counterpart of the Spark builder's from_json flattening: extracts
   * each schema field straight off the native VARIANT column, no intermediate
   * parsed-struct alias. Level structure mirrors the Spark twin:
   *   1 (innermost): base WHERE against raw columns.
   *   2: `* EXCLUDE (variants, excepts)` + typed per-field extractions.
   *   3 (when post-flatten filters exist): wrapping SELECT with WHERE, since
   *      the extracted fields only resolve as columns one level up.
   *   4 (when explicit select columns): final projection.
   */
  build(): string {
    if (!this.fromClause) {
      throw new Error("FROM clause is required");
    }
    if (this.variantColumns.length === 0) {
      throw new Error("At least one VARIANT column is required");
    }

    const where =
      this.whereConditions.length > 0 ? `WHERE ${this.whereConditions.join(" AND ")}` : "";
    const whereFlattened =
      this.whereFlattenedConditions.length > 0
        ? `WHERE ${this.whereFlattenedConditions.join(" AND ")}`
        : "";
    const order = this.orderByClause ? `ORDER BY ${this.orderByClause}` : "";
    const limitClause = this.limitValue ? `LIMIT ${this.limitValue}` : "";
    const offsetClause = this.offsetValue ? `OFFSET ${this.offsetValue}` : "";

    const allExceptColumns = [...this.variantColumns.map((v) => v.column), ...this.exceptColumns];

    const extractions = this.variantColumns
      .flatMap((v) =>
        VariantSchema.topLevelFields(v.schema).map((field) =>
          this.fieldExtraction(v.column, field),
        ),
      )
      .join(",\n        ");

    const flattenedView = `
      SELECT
        ${this.starExceptClause(allExceptColumns)},
        ${extractions}
      FROM (
        SELECT *
        FROM ${this.fromClause}
        ${where}
      )
    `.trim();
    const filteredFlattened =
      this.whereFlattenedConditions.length > 0
        ? `SELECT * FROM (${flattenedView}) ${whereFlattened}`.trim()
        : flattenedView;

    if (this.selectClause !== "*") {
      const selectKeyword = this.isDistinct ? "SELECT DISTINCT" : "SELECT";
      return `
        ${selectKeyword} ${this.selectClause}
        FROM (
          ${filteredFlattened}
        )
        ${order}
        ${limitClause}
        ${offsetClause}
      `.trim();
    }

    return `
      ${filteredFlattened}
      ${order}
      ${limitClause}
      ${offsetClause}
    `.trim();
  }
}
