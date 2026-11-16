import { readdirSync, readFileSync } from "fs";
import { resolve } from "path";

const MIGRATIONS = resolve(__dirname, "../../../../packages/database/clickhouse/migrations");

/** The serving store's migrations as single statements, in the order they apply. */
export function storeMigrationStatements(): string[] {
  const files = readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  return files.flatMap((file) => {
    const statements: string[] = [];
    let lines: string[] = [];
    for (const line of readFileSync(resolve(MIGRATIONS, file), "utf-8").split("\n")) {
      lines.push(line);
      if (line.trimEnd().endsWith(";")) {
        statements.push(lines.join("\n").trimEnd().replace(/;$/, ""));
        lines = [];
      }
    }
    const rest = lines.filter((line) => line.trim() !== "" && !line.trim().startsWith("--"));
    return rest.length > 0 ? [...statements, lines.join("\n")] : statements;
  });
}
