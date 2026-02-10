export interface ExecuteStatementRequest {
  statement: string;
  warehouse_id: string;
  schema: string;
  catalog: string;
  wait_timeout: string;
  disposition: string;
  format: string;
  byte_limit?: number;
  row_limit?: number;
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
  result?: {
    data_array?: (string | null)[][];
    chunk_index: number;
    row_count: number;
    row_offset: number;
    external_links?: {
      chunk_index: number;
      row_count: number;
      row_offset: number;
      byte_count: number;
      external_link: string;
      expiration: string;
    }[];
  };
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

export interface DownloadLinksData {
  external_links: {
    chunk_index: number;
    row_count: number;
    row_offset: number;
    byte_count: number;
    external_link: string;
    expiration: string;
  }[];
  totalRows: number;
  format: string;
}
