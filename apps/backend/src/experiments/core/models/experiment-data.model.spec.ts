import { ExperimentTableName } from "@repo/api/domains/experiment/data/experiment-data.schema";

import {
  MACRO_TABLE_CONFIG,
  STATIC_TABLE_CONFIG,
  UPLOAD_TABLE_CONFIG,
} from "./experiment-data.model";
import type { TableConfig } from "./experiment-data.model";

/**
 * The enriched layer used to hide these by projecting a narrower column list.
 * Serving gold directly makes hiding them the backend's job, and the backend
 * hides by exclusion, so a deleted entry here is a silent disclosure rather
 * than a visible break. That is what these pin.
 */
const RAW_IDENTIFIERS: Record<string, string[]> = {
  [ExperimentTableName.RAW_DATA]: ["user_id", "client_id"],
  macro: ["user_id", "client_id"],
  upload: ["created_by"],
};

const rawDataConfig = STATIC_TABLE_CONFIG[ExperimentTableName.RAW_DATA];

if (!rawDataConfig) {
  throw new Error("STATIC_TABLE_CONFIG is missing an entry for raw data");
}

const servedConfigs: [string, TableConfig][] = [
  [ExperimentTableName.RAW_DATA, rawDataConfig],
  ["macro", MACRO_TABLE_CONFIG],
  ["upload", UPLOAD_TABLE_CONFIG],
];

describe("served table configuration", () => {
  it.each(servedConfigs)("%s excludes every raw identifier", (name, config) => {
    for (const column of RAW_IDENTIFIERS[name]) {
      expect(config.exceptColumns).toContain(column);
    }
  });

  it.each(servedConfigs)("%s replaces each raw identifier with a pseudonym", (name, config) => {
    const produced = config.enrichmentJoins.flatMap((join) =>
      join.select.map((column) => column.alias),
    );

    // Excluding an identifier without joining its pseudonym would not leak
    // anything, but it would silently drop a column the UI renders.
    expect(produced).toContain("contributor");
    expect(RAW_IDENTIFIERS[name].length).toBeGreaterThan(0);
  });

  it("joins each dimension on the experiment as well as the identifier", () => {
    for (const [, config] of servedConfigs) {
      for (const join of config.enrichmentJoins) {
        const columns = join.on.map((pair) => pair.served);

        // A pseudonym is salted per experiment, so joining on the user alone
        // would resolve one contributor across every experiment they touch.
        expect(columns).toContain("experiment_id");
        expect(join.on.length).toBeGreaterThan(1);
      }
    }
  });

  it("names no dimension with a catalog, because the adapter qualifies it", () => {
    for (const [, config] of servedConfigs) {
      for (const join of config.enrichmentJoins) {
        expect(join.relation).not.toContain(".");
      }
    }
  });
});
