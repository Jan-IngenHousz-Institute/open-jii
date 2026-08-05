# Workbook cell-tree consumer matrix

This matrix is the audit record for introducing lane bodies. The review pass deliberately starts
from root-array access patterns instead of a remembered consumer list:

```sh
rg -n --glob '!**/*.{spec,test}.{ts,tsx}' \
  '\b(cells|liveCells|allCells|state\.cells|producer\.body|location\.body|body|lanes)\.(find|findIndex|filter|map|some|every|flatMap|reduce)\(' \
  packages/api/src/transforms packages/workbook/src apps/web/components/workbook \
  apps/web/hooks/workbook
```

Whole-workbook lookup and enumeration must go through `workbook-cell-tree.ts`. A direct array operation is sanctioned only when the array is already one resolved body, or when the operation deliberately projects/reorders root container nodes.

| Consumer                                       | Required tree semantics                                                | Resolver / disposition                                                              | Regression coverage                                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Workbook schema array refinement               | Whole shallow tree; global cell/question/container identity            | `walkWorkbookCells`-equivalent recursive refinement inside schema                   | `workbook-cells.schema.spec.ts` — duplicate cross-lane ids and canonical names                   |
| `validateWorkbook` entity and reference checks | Whole tree plus consumer-visible scope                                 | `walkWorkbookCells`, `resolveCellScope`, `sameCellPath`                             | `validate-workbook.spec.ts` — cross-lane, root-into-body, lane escape                            |
| `structuralBranchIssues`                       | One already-resolved body at a time                                    | Direct body `map`/index is sanctioned; caller de-duplicates bodies by `cellPathKey` | Existing reachability tests plus lane-scoped validation tests                                    |
| Macro namespace                                | Ancestor prefixes and same-body prefix only                            | `resolveCellScope`; producer output lookup remains in producer body                 | `build-cell-namespace.spec.ts` — ancestor + same lane, sibling excluded                          |
| Branch evaluation                              | Same scope as macros and authoring                                     | `findWorkbookCell`, `resolveCellScope`; goto validation via `branchTargetCells`     | `evaluate-branch.spec.ts`, `workbook-cell-tree.spec.ts`                                          |
| Parallel lane assignment                       | Container scope, per-device conditions, explicit default only          | `assignParallelLanes` reuses `evaluatePathConditions`                               | `evaluate-branch.spec.ts` — conditionless lane, fallback, empty roster, ambiguous default        |
| Flow projection `cellsToFlowGraph`             | Root nodes only; lane bodies are opaque container content              | Direct root loop is sanctioned and atomic                                           | `cells-to-flow.spec.ts` — one container node, no flat body siblings, old reader drops atomically |
| Flow ingestion `flowNodesToWorkbookCells`      | Root graph nodes only; container content parsed as one cell            | Direct ordered-node loop is sanctioned; `zParallelCell` parses body atomically      | `flow-to-workbook-cells.spec.ts` — byte-identical container round trip                           |
| Runtime `cellById`                             | Stable-id lookup across tree, optionally body-constrained              | `findWorkbookCell`, `findWorkbookCellInBody`                                        | `flow-utils.spec.ts`                                                                             |
| Runtime next/previous/goto                     | Current resolved body only                                             | Location body from `findWorkbookCell`; goto uses `findWorkbookCellInBody`           | `flow-utils.spec.ts` — no sibling navigation/goto                                                |
| Runtime upstream producer                      | Ancestor + same-lane earlier cells                                     | `resolveCellScope`                                                                  | `flow-utils.spec.ts` — sibling producers never leak                                              |
| Downstream stale marking                       | Cells after producer in the producer's body only                       | Location body from `findWorkbookCell`                                               | Scheduler/runner scenarios and `flow-utils.spec.ts`                                              |
| Runner startup validation                      | Global ids/names, per-container lane/default invariants                | `walkWorkbookCells`                                                                 | schema tests plus runner construction tests                                                      |
| Host view output seed/carry-over/merge         | Output owner must be in the same body; retain producer-relative offset | `walkWorkbookCells` for carry-over; recursive body renderer for merge               | `host-view.spec.ts` — nested output ownership and position                                       |
| Cell hydration                                 | Rehydrate owner output only in its body                                | `walkWorkbookCells` + recursive body hydration                                      | `hydrate.spec.ts` and host-view regression                                                       |
| Snapshot v1 interaction lookup                 | v1 schema is flat and cannot contain containers                        | Direct `state.cells.find` is intentionally retained for migration-only data         | v1→v2 snapshot migration suite                                                                   |
| Upgrade compatibility entity collection        | Protocols/macros anywhere in tree                                      | `walkWorkbookCells`                                                                 | Upgrade dialog suite + API validation tests                                                      |
| Header protocol/macro/output gates and export  | Protocols/macros/outputs anywhere in tree                              | `walkWorkbookCells`                                                                 | `workbook-header.test.tsx` — nested-only workbooks enable each action                            |
| Header JSON projection                         | Preserve tree while clearing UI collapse state                         | `mapWorkbookCellTree`                                                               | Typecheck; byte-identical converter suite                                                        |
| Draft run lookup and output count              | Stable-id lookup / whole-tree output enumeration                       | `findWorkbookCell`, `walkWorkbookCells`                                             | Execution hook suite + traversal tests                                                           |
| Clear all outputs                              | Remove output cells in every lane without flattening containers        | Nullable `mapWorkbookCellTree` filter                                               | `useWorkbookExecution.test.ts` — nested output removed; tree mapper unit test                    |
| Pending interaction question lookup            | Track-local cell can live in a lane                                    | `findWorkbookCell`                                                                  | Execution hook suite; lane interaction scenarios in lane-execution ticket                        |
| Branch authoring source selector               | Same resolver as runtime and validation                                | `findWorkbookCell`, `resolveCellScope`                                              | Branch component suite + traversal tests                                                         |
| Branch authoring jump selector                 | Same body only                                                         | `branchTargetCells`                                                                 | Branch component suite + traversal tests                                                         |
| Workbook sidebar/root drag grouping            | Root container nodes only; lane body ordering belongs to container     | Direct root `filter`/grouping is sanctioned                                         | Workbook editor drag tests                                                                       |
| Workbook editor root insert/delete/reorder     | Root body only; nested editing is owned by the container               | Direct root array operations are sanctioned                                         | Workbook editor tests                                                                            |
| Parallel List authoring                        | Lane mutations use object/index identity; bodies stay lane-local       | Shared `BranchCellComponent` condition editor + recursive `CellRenderer`            | `parallel-cell.test.tsx` — conditions, default rehome, lane creation                             |
| Cell summary and optimistic validation context | Whole tree                                                             | `walkWorkbookCells`                                                                 | Summary/validation suites                                                                        |
| Output presentation source lookup              | Producer may live in a lane                                            | `findWorkbookCell`                                                                  | `output-cell.test.tsx` — nested protocol enables timeseries                                      |

## Direct-access disposition from the review grep

Every remaining match from the command above was inspected. These are the sanctioned direct
collection operations; anything outside this list should be treated as a new audit item.

| Site                                                          | Why direct access is correct                                                                                                                                    |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validate-workbook.ts` structural body map/index/entries      | The caller has already split the workbook into resolved bodies; reachability must not cross a lane boundary.                                                    |
| `flow-to-workbook-cells.ts` producer `findIndex`              | The flow projection is deliberately root-only; container content is an atomic node, and output placement preserves producer-relative offset in that root order. |
| `workbook-cell-tree.ts` body operations                       | These implement the sanctioned recursive resolver itself; every body is selected by a unique container/lane path.                                               |
| `build-cell-namespace.ts` producer-body output lookup         | The producer location is resolved by scope first; its output must be found in that exact body.                                                                  |
| `evaluate-branch.ts` lane `map`/`find`                        | `assignParallelLanes` rejects duplicate lane ids before selecting; iteration is over the one container's lanes.                                                 |
| `flow-utils.ts` location-body filters                         | `findWorkbookCell` resolved the unique cell and body before next/previous navigation.                                                                           |
| `hydrate.ts` recursive body map                               | This is the recursive hydrator; it descends through lane bodies without flattening them.                                                                        |
| `cell-entry.ts` lane/body operations                          | Operations are attempt-local: frozen lane specs, one resolved track body, purge ids, and all-lanes-terminal barrier checks.                                     |
| `host-view.ts` location/body operations                       | Output ownership and merge position are intentionally constrained to the already-resolved producer body.                                                        |
| `snapshot.ts` `state.cells.find`                              | v1 snapshots predate containers and are necessarily flat; this lookup is migration-only.                                                                        |
| `parallel-cell.tsx` lane/body map/filter                      | List authoring is intentionally lane-local and mutations select by object/index identity, never by an ambiguous serialized id.                                  |
| `branch-cell.tsx` lane id map and location-body output lookup | Lane fields are exposed only when ids are unique; producer output lookup is constrained to the resolved source body.                                            |
| `workbook-editor.tsx` root grouping/insert/delete/reorder     | The outer list owns root nodes; nested editing is delegated to the container component.                                                                         |
| `workbook-sidebar.tsx` root filter                            | The outline shows each container as one root entry; lane bodies are represented inside that entry rather than flattened.                                        |

The review grep also rediscovered three whole-tree consumers that no longer appear as direct-array
matches: Clear-all now uses `mapWorkbookCellTree`, header capability gates use
`walkWorkbookCells`, and output presentation uses `findWorkbookCell`. Their regression tests are
listed above.

The audit is expected to be rerun whenever a new cell consumer is added. A global `find` may appear correct in a single-lane fixture while reading a sibling lane at runtime, so stable-id uniqueness is enforced in addition to resolver discipline.
