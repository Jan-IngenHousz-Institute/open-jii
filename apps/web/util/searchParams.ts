export type SearchParamType = string | string[] | undefined;

export type SearchParamsType = Promise<Record<string, SearchParamType>>;

export function getFirstSearchParam(searchParam: SearchParamType) {
  return Array.isArray(searchParam) ? searchParam[0] : searchParam;
}
