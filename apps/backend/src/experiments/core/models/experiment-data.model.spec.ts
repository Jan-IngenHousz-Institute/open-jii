import { ExperimentTableName } from "@repo/api/domains/experiment/data/experiment-data.schema";

import {
  MACRO_TABLE_CONFIG,
  STATIC_TABLE_CONFIG,
  UPLOAD_TABLE_CONFIG,
} from "./experiment-data.model";
import type { EnrichmentSql, TableConfig } from "./experiment-data.model";

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

/** These assertions are about join shape, so the SQL spelling is irrelevant. */
const STUB_SQL: EnrichmentSql = {
  emptyArray: "[]",
  concatArrays: (left, right) => `${left}|${right}`,
  struct: (fields) => fields.map(([name]) => name).join(","),
  sortedCollect: (inner) => inner,
  castToString: (expression) => expression,
  customMetadata: ({ matchableColumns, hasQuestionsData }) => ({
    derive: `(SELECT experiment_id FROM {relation} GROUP BY experiment_id)`,
    expression: `metadata(${matchableColumns.join(",")},${String(hasQuestionsData)})`,
  }),
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
  for (const [name, config] of servedConfigs) {
    describe(name, () => {
      const joins = config.enrichmentJoins(STUB_SQL);

      it("excludes every raw identifier", () => {
        for (const column of RAW_IDENTIFIERS[name]) {
          expect(config.exceptColumns).toContain(column);
        }
      });

      it("replaces each raw identifier with a pseudonym", () => {
        const produced = joins.flatMap((join) => join.select.map((column) => column.alias));

        // Excluding an identifier without joining its pseudonym would not leak
        // anything, but it would silently drop a column the UI renders.
        expect(produced).toContain("contributor");
        expect(RAW_IDENTIFIERS[name].length).toBeGreaterThan(0);
      });

      it("scopes every dimension to the experiment", () => {
        for (const join of joins) {
          // Without this a contributor pseudonym, which is salted per
          // experiment, would resolve across every experiment they touch, and
          // a metadata blob would match measurements from another study.
          expect(join.on.map((pair) => pair.served)).toContain("experiment_id");
        }
      });

      it("supplies every variant column the served relation does not carry", () => {
        // These exist only in the enriched layer. Excluding one would fail,
        // because there is nothing on the base relation to exclude.
        const produced = joins.flatMap((join) => join.select.map((column) => column.alias));

        for (const column of config.enrichedVariantColumns) {
          expect(produced).toContain(column);
        }
      });

      it("names no dimension with a catalog, because the adapter qualifies it", () => {
        for (const join of joins) {
          expect(join.relation).not.toContain(".");
        }
      });

      it("excludes any base column a join reads and re-projects", () => {
        // A join that folds a base column into its own output shadows it: both
        // end up projected under one name and the un-enriched one wins on read.
        // Reading `base.<alias>` is exactly the signal that this has happened.
        const shadowed = joins.flatMap((join) =>
          join.select
            .filter((column) => column.expression.includes(`base.${column.alias}`))
            .map((column) => column.alias),
        );

        for (const alias of shadowed) {
          expect(config.exceptColumns).toContain(alias);
        }
      });
    });
  }
});
