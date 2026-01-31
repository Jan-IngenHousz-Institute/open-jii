export interface ColumnInfo {
  name: string;
  type_text: string;
  type_name: string;
  position: number;
  nullable?: boolean;
  comment?: string;
  type_json?: string;
  type_precision?: number;
  type_scale?: number;
  partition_index?: number;
}

export interface Table {
  name: string;
  catalog_name: string;
  schema_name: string;
  table_type: string;
  comment?: string;
  created_at: number;
  columns?: ColumnInfo[];
  properties?: {
    display_name?: string;
    downstream?: "true" | "false";
    quality?: "bronze" | "silver" | "gold";
    error_column?: string;
    [key: string]: string | undefined;
  };
}

export interface ListTablesResponse {
  tables: Table[];
  next_page_token?: string;
}
