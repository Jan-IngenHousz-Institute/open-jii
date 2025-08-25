export interface Table {
  name: string;
  catalog_name: string;
  schema_name: string;
  table_type: string;
  comment?: string;
  created_at: number;
}

export interface ListTablesResponse {
  tables: Table[];
  next_page_token?: string;
}
