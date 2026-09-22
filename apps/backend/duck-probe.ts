import { DuckDBInstance } from "@duckdb/node-api";

const CANDIDATES: [string, string][] = [
  ["map -> JSON -> VARIANT", `SELECT CAST(CAST(MAP {'a': 1} AS JSON) AS VARIANT) AS v`],
  ["map -> VARIANT direct", `SELECT CAST(MAP {'a': 1} AS VARIANT) AS v`],
  [
    "variant_extract off the cast",
    `SELECT variant_extract(CAST(CAST(MAP {'plot': '\"A\"'} AS JSON) AS VARIANT), 'plot') AS v`,
  ],
  [
    "json map values stay quoted?",
    `SELECT CAST(CAST(map_from_entries([{'key': 'plot', 'value': CAST('\"A\"' AS JSON)}]) AS JSON) AS VARIANT) AS v`,
  ],
];

async function main() {
  const instance = await DuckDBInstance.create(":memory:");
  const connection = await instance.connect();

  for (const [name, sql] of CANDIDATES) {
    try {
      const reader = await connection.runAndReadAll(sql);
      console.log(`  yes  ${name} -> ${JSON.stringify(reader.getRowObjects()[0].v)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
      console.log(`  NO   ${name} -> ${message.slice(0, 90)}`);
    }
  }

  connection.closeSync();
  instance.closeSync();
}

void main();
