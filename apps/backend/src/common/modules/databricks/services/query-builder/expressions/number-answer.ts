import { NUMBER_ANSWER_PATTERN } from "@repo/api/transforms/number-answer";

/** Gold retains lexical answers. Only the experiment's approved fields use this cast. */
export function numberAnswerExpression(value: string): string {
  const number = `try_cast(trim(${value}) AS DOUBLE)`;
  return `CASE WHEN ${value} RLIKE r'${NUMBER_ANSWER_PATTERN}' THEN nullif(nullif(nullif(${number}, double('NaN')), double('Infinity')), double('-Infinity')) END`;
}
