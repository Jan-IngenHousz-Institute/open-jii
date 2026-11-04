import { Inject, Injectable } from "@nestjs/common";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import { cellsToFlowGraph } from "@repo/api/transforms/cells-to-flow";
import { sanitizeQuestionLabel } from "@repo/api/transforms/label-sanitization";
import {
  and,
  eq,
  experimentQuestionTypes,
  experiments,
  flows,
  inArray,
  workbookVersions,
} from "@repo/database";
import type { DatabaseInstance, DbOrTx } from "@repo/database";

import { AppError, tryCatch } from "../../../common/utils/fp-utils";
import type { WorkbookVersionDto } from "../../../workbooks/core/models/workbook-version.model";
import type { FlowDto, FlowGraphDto } from "../models/flow.model";

interface Question {
  name: string;
  kind: string;
}

function questions(cells: WorkbookCell[]): Question[] {
  return cells.flatMap((cell) =>
    cell.type === "question" ? [{ name: cell.name, kind: cell.question.kind }] : [],
  );
}

function graphQuestions(graph: FlowGraphDto): Question[] {
  return graph.nodes.flatMap((node) =>
    node.type === "question"
      ? [{ name: node.name, kind: "kind" in node.content ? node.content.kind : "open_ended" }]
      : [],
  );
}

@Injectable()
export class ExperimentQuestionTypesRepository {
  constructor(@Inject("DATABASE") private readonly database: DatabaseInstance) {}

  activeNumericKeys(experimentId: string) {
    return tryCatch(async () => {
      const rows = await this.database
        .select({ key: experimentQuestionTypes.key })
        .from(experimentQuestionTypes)
        .where(
          and(
            eq(experimentQuestionTypes.experimentId, experimentId),
            eq(experimentQuestionTypes.active, true),
          ),
        );
      return rows.map((row) => row.key).sort();
    });
  }

  activeNumericKeysForExperiments(experimentIds: string[]) {
    return tryCatch(async () => {
      const ids = [...new Set(experimentIds)];
      const rows = await this.database
        .select({
          experimentId: experimentQuestionTypes.experimentId,
          key: experimentQuestionTypes.key,
        })
        .from(experimentQuestionTypes)
        .where(
          and(
            inArray(experimentQuestionTypes.experimentId, ids),
            eq(experimentQuestionTypes.active, true),
          ),
        );
      return ids.map((experimentId) => ({
        experimentId,
        numericKeys: rows
          .filter((row) => row.experimentId === experimentId.toLowerCase())
          .map((row) => row.key)
          .sort(),
      }));
    });
  }

  /** The experiment lock serializes pins and flow edits, including remove/reintroduce and concurrent pins. */
  pinVersion(
    experimentId: string,
    version: WorkbookVersionDto,
    { legacyImport = false }: { legacyImport?: boolean } = {},
  ) {
    return tryCatch(() =>
      this.database.transaction(async (tx) => {
        const experiment = (
          await tx.select().from(experiments).where(eq(experiments.id, experimentId)).for("update")
        ).at(0);
        if (!experiment) throw AppError.notFound("Experiment not found");
        if (experiment.workbookVersionId) {
          const previous = (
            await tx
              .select()
              .from(workbookVersions)
              .where(eq(workbookVersions.id, experiment.workbookVersionId))
          ).at(0);
          if (previous)
            await this.record(tx, experimentId, questions(previous.cells as WorkbookCell[]), {
              activate: false,
              historical: true,
            });
        }
        const previousFlow = (
          await tx.select().from(flows).where(eq(flows.experimentId, experimentId))
        ).at(0);
        if (previousFlow)
          await this.record(tx, experimentId, graphQuestions(previousFlow.graph as FlowGraphDto), {
            activate: false,
            historical: true,
          });
        await this.record(tx, experimentId, questions(version.cells), {
          activate: experiment.questionTypesTracked,
          historical: legacyImport,
        });
        const graph = cellsToFlowGraph(version.cells);
        await tx
          .insert(flows)
          .values({ experimentId, graph })
          .onConflictDoUpdate({ target: flows.experimentId, set: { graph } });
        await tx
          .update(experiments)
          .set({ workbookId: version.workbookId, workbookVersionId: version.id })
          .where(eq(experiments.id, experimentId));
      }),
    );
  }

  saveFlow(
    experimentId: string,
    graph: FlowGraphDto,
    mode: "create" | "update" | "upsert",
    { legacyImport = false }: { legacyImport?: boolean } = {},
  ) {
    return tryCatch(() =>
      this.database.transaction(async (tx) => {
        const experiment = (
          await tx.select().from(experiments).where(eq(experiments.id, experimentId)).for("update")
        ).at(0);
        if (!experiment) throw AppError.notFound("Experiment not found");
        const previous = (
          await tx.select().from(flows).where(eq(flows.experimentId, experimentId))
        ).at(0);
        if (previous)
          await this.record(tx, experimentId, graphQuestions(previous.graph as FlowGraphDto), {
            activate: false,
            historical: true,
          });
        await this.record(tx, experimentId, graphQuestions(graph), {
          activate: experiment.questionTypesTracked,
          historical: legacyImport,
        });
        const rows =
          mode === "update"
            ? await tx
                .update(flows)
                .set({ graph })
                .where(eq(flows.experimentId, experimentId))
                .returning()
            : mode === "create"
              ? await tx.insert(flows).values({ experimentId, graph }).returning()
              : await tx
                  .insert(flows)
                  .values({ experimentId, graph })
                  .onConflictDoUpdate({ target: flows.experimentId, set: { graph } })
                  .returning();
        const saved = rows.at(0);
        if (!saved) throw AppError.notFound("Flow not found");
        return saved as FlowDto;
      }),
    );
  }

  private async record(
    tx: DbOrTx,
    experimentId: string,
    items: Question[],
    { activate, historical = false }: { activate: boolean; historical?: boolean },
  ) {
    const seen = new Set<string>();
    for (const item of items) {
      const key = sanitizeQuestionLabel(item.name);
      if (seen.has(key) && !historical)
        throw AppError.badRequest(
          `Question names must have distinct column keys: "${key}".`,
          "DUPLICATE_QUESTION_KEY",
        );
      const duplicate = seen.has(key);
      seen.add(key);
      const declaredClass = item.kind === "number" ? "number" : "text";
      await tx
        .insert(experimentQuestionTypes)
        .values({
          experimentId,
          key,
          declaredClass,
          active: activate && declaredClass === "number",
          evidence: activate ? "Tracked since experiment creation" : null,
        })
        .onConflictDoNothing();
      const existing = (
        await tx
          .select()
          .from(experimentQuestionTypes)
          .where(
            and(
              eq(experimentQuestionTypes.experimentId, experimentId),
              eq(experimentQuestionTypes.key, key),
            ),
          )
      ).at(0);
      if (!existing) throw AppError.internal("Question declaration was not recorded");
      if (historical && (duplicate || existing.declaredClass !== declaredClass)) {
        await tx
          .update(experimentQuestionTypes)
          .set({
            active: false,
            evidence: "Ambiguous legacy question names or kinds; review before activation",
          })
          .where(
            and(
              eq(experimentQuestionTypes.experimentId, experimentId),
              eq(experimentQuestionTypes.key, key),
            ),
          );
        continue;
      }
      if (existing.declaredClass !== declaredClass)
        throw AppError.badRequest(
          `Question "${item.name}" already uses a ${existing.declaredClass} column in this experiment. Give the question a new name to switch between Number and text.`,
          "QUESTION_TYPE_CHANGE",
        );
    }
  }
}
