export interface SelectQueryParams {
  table: string;
  columns?: string[];
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

export interface VariantParseQueryParams {
  table: string;
  selectColumns: string[];
  variantColumn: string;
  variantSchema: string;
  whereClause?: string;
  orderBy?: string;
  limit?: number;
  offset?: number;
}
