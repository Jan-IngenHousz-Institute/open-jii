import { mkdirSync, writeFileSync } from "node:fs";

import * as fixtures from "../test/status-fixtures";

// The dev server serves public/ where production serves the publisher's file. The document is
// stamped with the current time, minus an optional age in minutes to show the stale view.
const [name = "operationalStatusDocument", minutesOld = "0"] = process.argv.slice(2);
const documents = Object.entries(fixtures).filter(([key]) => key.endsWith("StatusDocument"));
const found = documents.find(([key]) => key === name);

if (found === undefined) {
  const names = documents.map(([key]) => key).join(", ");
  throw new Error(`Unknown fixture ${name}. Choose from ${names}`);
}

const generatedAt = new Date(Date.now() - Number(minutesOld) * 60_000).toISOString();

mkdirSync("public/data", { recursive: true });
writeFileSync("public/data/status.json", JSON.stringify({ ...found[1], generatedAt }));
