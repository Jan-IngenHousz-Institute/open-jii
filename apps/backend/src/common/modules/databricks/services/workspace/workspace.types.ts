export interface ImportWorkspaceObjectRequest {
  content: string; // Base64-encoded content
  format?: WorkspaceObjectFormat;
  language?: WorkspaceObjectLanguage;
  overwrite?: boolean;
  path: string; // Absolute path of the object or directory
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ImportWorkspaceObjectResponse {
  // Empty response on success
}

export interface DeleteWorkspaceObjectRequest {
  path: string; // Absolute path of the notebook or directory
  recursive?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface DeleteWorkspaceObjectResponse {
  // Empty response on success
}

export enum WorkspaceObjectFormat {
  SOURCE = "SOURCE",
  HTML = "HTML",
  JUPYTER = "JUPYTER",
  DBC = "DBC",
  R_MARKDOWN = "R_MARKDOWN",
  AUTO = "AUTO",
  RAW = "RAW",
}

export enum WorkspaceObjectLanguage {
  SCALA = "SCALA",
  PYTHON = "PYTHON",
  SQL = "SQL",
  R = "R",
}
