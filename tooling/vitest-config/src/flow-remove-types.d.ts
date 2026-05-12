declare module "flow-remove-types" {
  function removeTypes(code: string, options?: { all?: boolean }): { toString(): string };
  export default removeTypes;
}
