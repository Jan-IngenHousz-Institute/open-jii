/**
 * Value for a `:name` marker in the statement. The warehouse binds it, so it never becomes SQL
 * text. An omitted `value` binds NULL.
 */
export interface StatementParameter {
  name: string;
  value?: string;
  type?: "STRING" | "TIMESTAMP";
}

export interface ExecuteStatementRequest {
  statement: string;
  warehouse_id: string;
  schema: string;
  catalog: string;
  wait_timeout: string;
  on_wait_timeout: "CONTINUE" | "CANCEL";
  disposition: string;
  format: string;
  byte_limit?: number;
  row_limit?: number;
  parameters?: StatementParameter[];
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
    format?: string;
    total_byte_count?: number;
    total_chunk_count?: number;
    chunks?: {
      chunk_index: number;
      row_count: number;
      row_offset: number;
      byte_count?: number;
    }[];
  };
  result?: ResultChunk;
}

/** One chunk of an INLINE result. The statement response carries the first. */
export interface ResultChunk {
  data_array?: (string | null)[][];
  chunk_index: number;
  row_count: number;
  row_offset: number;
  next_chunk_index?: number;
  /** Path to the next chunk, joined to the workspace host. Absent on the last chunk. */
  next_chunk_internal_link?: string;
}

export interface SchemaData {
  columns: {
    name: string;
    type_name: string;
    type_text: string;
    position: number;
  }[];
  rows: (string | null)[][];
  totalRows: number;
  truncated: boolean;
}
