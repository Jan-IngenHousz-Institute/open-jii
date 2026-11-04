export const NUMBER_ANSWER_PATTERN =
  "^[\\x09-\\x0D ]*[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?[\\x09-\\x0D ]*$";

export function isNumberAnswer(value: string): boolean {
  return new RegExp(NUMBER_ANSWER_PATTERN).test(value) && Number.isFinite(Number(value));
}
