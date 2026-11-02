import { spawnSync } from "node:child_process";

import { cleanupDataExperiment, seedDataExperiment } from "../experiment-data-fixtures.js";
import { numericSortExperimentName } from "../numeric-question-sorting-fixtures.js";

await seedDataExperiment(numericSortExperimentName);
try {
  const result = spawnSync(
    "pnpm",
    [
      "capture-docs-media",
      "--only",
      "numeric-question-sorting-ascending,numeric-question-sorting",
      ...process.argv.slice(2),
    ],
    { stdio: "inherit", env: { ...process.env, E2E_NUMERIC_SORT_CAPTURE: "1" } },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  await cleanupDataExperiment(numericSortExperimentName);
}
