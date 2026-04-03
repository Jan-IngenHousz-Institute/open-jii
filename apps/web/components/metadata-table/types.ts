export interface MetadataColumn {
  id: string;
  name: string;
  type: "string" | "number" | "date";
}

export interface MetadataRow {
  _id: string;
  [key: string]: unknown;
}
