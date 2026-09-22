import { registerAs } from "@nestjs/config";

/**
 * DuckDB read-engine configuration. Catalog/schema/table names are reused
 * from the databricks.* namespace; only engine-specific knobs live here.
 */
export default registerAs("duckdb", () => ({
  memoryLimit: process.env.DUCKDB_MEMORY_LIMIT ?? "2GB",
  threads: process.env.DUCKDB_THREADS ?? "2",
  extensionDirectory: process.env.DUCKDB_EXTENSION_DIRECTORY,
  tempDirectory: process.env.DUCKDB_TEMP_DIRECTORY,
  localMode: process.env.DUCKDB_LOCAL_MODE === "true",
}));
