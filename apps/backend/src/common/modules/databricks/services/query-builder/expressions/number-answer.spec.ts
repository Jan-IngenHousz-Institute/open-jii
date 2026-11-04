import { NUMBER_ANSWER_PATTERN } from "@repo/api/transforms/number-answer";

import { numberAnswerExpression } from "./number-answer";

describe("numberAnswerExpression", () => {
  it("uses the shared strict grammar before attempting the DOUBLE conversion", () => {
    const expression = numberAnswerExpression("`questions`.`leaf height`");
    expect(expression).toMatch(/^CASE WHEN /);
    expect(expression).toContain(
      "`questions`.`leaf height` RLIKE r'" + NUMBER_ANSWER_PATTERN + "' THEN ",
    );
    expect(expression).toContain("try_cast(trim(`questions`.`leaf height`) AS DOUBLE)");
    expect(expression).toMatch(/ END$/);
  });

  it("excludes all nonfinite DOUBLE results, including overflow", () => {
    expect(numberAnswerExpression("answer")).toContain(
      "nullif(nullif(nullif(try_cast(trim(answer) AS DOUBLE), double('NaN')), double('Infinity')), double('-Infinity'))",
    );
  });
});
