import type { BaseQueryBuilder } from "../query-builder.base";
import type { FilterCondition } from "../query-builder.types";

/**
 * Compile a user filter into a SQL boolean expression. Schema-level validation
 * (`zDataFilter`) has already enforced operator/value compatibility, so the
 * defensive checks here only cover what would still generate invalid SQL.
 */
export function buildFilterCondition(filter: FilterCondition, builder: BaseQueryBuilder): string {
  const col = builder.escapeIdentifier(filter.column);
  const { operator, value } = filter;

  switch (operator) {
    case "equals":
    case "not_equals": {
      if (Array.isArray(value)) {
        throw new Error(`Operator '${operator}' does not accept array values`);
      }

      const op = operator === "equals" ? "=" : "<>";
      return `${col} ${op} ${builder.escapeScalarValue(value)}`;
    }
    case "greater_than":
    case "less_than":
    case "greater_than_or_equal":
    case "less_than_or_equal": {
      if (Array.isArray(value)) {
        throw new Error(`Operator '${operator}' does not accept array values`);
      }

      const op = (
        {
          greater_than: ">",
          less_than: "<",
          greater_than_or_equal: ">=",
          less_than_or_equal: "<=",
        } as const
      )[operator];

      return `${col} ${op} ${builder.escapeScalarValue(value)}`;
    }
    case "contains": {
      if (typeof value !== "string") {
        throw new Error("'contains' operator requires a string value");
      }

      // % and _ in user input are intentionally treated as wildcards.
      return `${col} LIKE ${builder.escapeValue(`%${value}%`)}`;
    }
    case "in": {
      if (!Array.isArray(value) || value.length === 0) {
        throw new Error("'in' operator requires a non-empty array of values");
      }

      const list = value.map((v) => builder.escapeScalarValue(v)).join(", ");
      return `${col} IN (${list})`;
    }
    case "between": {
      if (!Array.isArray(value) || value.length !== 2) {
        throw new Error("'between' operator requires a [start, end] array");
      }

      const [start, end] = value;
      if (Array.isArray(start) || Array.isArray(end)) {
        throw new Error("'between' bounds cannot be arrays");
      }

      return `${col} BETWEEN ${builder.escapeScalarValue(start)} AND ${builder.escapeScalarValue(end)}`;
    }
  }
}
