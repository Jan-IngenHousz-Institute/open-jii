/**
 * Migration script: Convert existing experiment flows into workbooks + versions.
 *
 * For each experiment that has a flow record but no workbook:
 *   1. Fetch the flow's graph (nodes + edges)
 *   2. Order nodes by edges
 *   3. Convert ordered nodes to workbook cells
 *   4. Create a new workbook named "{experiment.name} - Workbook"
 *   5. Create workbook version 1 with those cells
 *   6. Update experiment: set workbookId and workbookVersionId
 *
 * Idempotent: skips experiments that already have a workbook.
 * Run after schema migration 0027 is applied.
 *
 * Usage: npx tsx packages/database/scripts/migrate-flows-to-workbooks.ts
 */
import { eq, isNull, isNotNull } from "drizzle-orm";

import { flowNodesToWorkbookCells } from "../../api/src/utils/flow-to-workbook-cells";
import { db } from "../src/database";
import { experiments, flows, workbooks, workbookVersions } from "../src/schema";

interface FlowGraph {
  nodes: Array<{
    id: string;
    type: string;
    name: string;
    content: unknown;
    isStart?: boolean;
    position?: { x: number; y: number };
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string | null;
  }>;
}

async function main() {
  console.log("Starting flow-to-workbook migration...");

  // Find experiments with flows but no workbook
  const candidates = await db
    .select({
      experimentId: experiments.id,
      experimentName: experiments.name,
      createdBy: experiments.createdBy,
      flowId: flows.id,
      graph: flows.graph,
    })
    .from(experiments)
    .innerJoin(flows, eq(flows.experimentId, experiments.id))
    .where(isNull(experiments.workbookId));

  console.log(`Found ${candidates.length} experiment(s) with flows but no workbook.`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      const graph = candidate.graph as FlowGraph;
      if (!graph?.nodes?.length) {
        console.log(`  Skipping "${candidate.experimentName}" - empty flow graph`);
        skipped++;
        continue;
      }

      // Convert flow nodes to workbook cells
      const cells = flowNodesToWorkbookCells(
        graph.nodes as Parameters<typeof flowNodesToWorkbookCells>[0],
        graph.edges as Parameters<typeof flowNodesToWorkbookCells>[1],
      );

      if (cells.length === 0) {
        console.log(`  Skipping "${candidate.experimentName}" - no convertible nodes`);
        skipped++;
        continue;
      }

      // Create workbook
      const [workbook] = await db
        .insert(workbooks)
        .values({
          name: `${candidate.experimentName} - Workbook`,
          description: `Auto-migrated from experiment flow`,
          cells,
          metadata: {},
          createdBy: candidate.createdBy,
        })
        .returning();

      // Create version 1
      const [version] = await db
        .insert(workbookVersions)
        .values({
          workbookId: workbook.id,
          version: 1,
          cells,
          metadata: {},
          createdBy: candidate.createdBy,
        })
        .returning();

      // Link experiment to workbook + version
      await db
        .update(experiments)
        .set({
          workbookId: workbook.id,
          workbookVersionId: version.id,
        })
        .where(eq(experiments.id, candidate.experimentId));

      console.log(
        `  Migrated "${candidate.experimentName}" -> workbook "${workbook.name}" (${cells.length} cells, version 1)`,
      );
      migrated++;
    } catch (error) {
      console.error(`  FAILED "${candidate.experimentName}":`, error);
      failed++;
    }
  }

  console.log(`\nMigration complete: ${migrated} migrated, ${skipped} skipped, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
