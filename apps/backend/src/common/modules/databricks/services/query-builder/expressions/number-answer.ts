import { NUMBER_ANSWER_PATTERN } from "@repo/api/transforms/number-answer";

/** Approved fields use the same finite cast for lexical legacy rows and typed gold values. */
export function numberAnswerExpression(value: string): string {
  const number = `try_cast(trim(${value}) AS DOUBLE)`;
  return `CASE WHEN ${value} RLIKE r'${NUMBER_ANSWER_PATTERN}' THEN nullif(nullif(nullif(${number}, double('NaN')), double('Infinity')), double('-Infinity')) END`;
}
