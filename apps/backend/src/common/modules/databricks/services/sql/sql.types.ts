export interface ExecuteStatementRequest {
  statement: string;
  warehouse_id: string;
  schema: string;
  catalog: string;
  wait_timeout: string;
  disposition: string;
  format: string;
}

export interface StatementResponse {
  statement_id: string;
  status: {
    state: string;
    error?: {
      message?: string;
      error_code?: string;
    };
  };
  manifest?: {
    schema: {
      column_count: number;
      columns: {
        name: string;
        type_name: string;
        type_text: string;
        position: number;
      }[];
    };
    total_row_count?: number;
    truncated?: boolean;
  };
  result?: {
    data_array: (string | null)[][];
    chunk_index: number;
    row_count: number;
    row_offset: number;
  };
}

export interface SchemaData {
  columns: {
    name: string;
    type_name: string;
    type_text: string;
  }[];
  rows: (string | null)[][];
  totalRows: number;
  truncated: boolean;
}
