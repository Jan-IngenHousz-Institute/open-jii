export interface QueryParams {
  table: string;
  columns?: string[];
  variants?: { columnName: string; schema: string }[];
  exceptColumns?: string[];
  whereClause?: string;
  whereConditions?: [string, string][];
  orderBy?: string;
  orderDirection?: "ASC" | "DESC";
  limit?: number;
  offset?: number;
}

export interface CountQueryParams {
  table: string;
  whereClause?: string;
  whereConditions?: [string, string][];
}
