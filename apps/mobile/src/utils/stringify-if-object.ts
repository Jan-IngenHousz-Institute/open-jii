export function stringifyIfObject(value: string | object) {
  return typeof value === "object" ? JSON.stringify(value) : value;
}
