export interface Table {
  name: string;
  catalog_name: string;
  schema_name: string;
  table_type: string;
  comment?: string;
  created_at: number;
  properties?: {
    display_name?: string;
    downstream?: "true" | "false";
    quality?: "bronze" | "silver" | "gold";
    [key: string]: string | undefined;
  };
}

export interface ListTablesResponse {
  tables: Table[];
  next_page_token?: string;
}
