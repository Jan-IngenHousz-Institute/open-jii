import type { z } from "zod";

import type {
  DeviceAnswer,
  DeviceOnboardingConfig,
  DeviceProcedure,
} from "../domains/iot/iot.schema";
import type { zWorkbookCellArray } from "../domains/workbook/workbook-cells.schema";
import type { EntitySnapshots } from "../domains/workbook/workbook-version.schema";

type WorkbookCells = z.infer<typeof zWorkbookCellArray>;

export interface DevicePlan {
  procedures: DeviceProcedure[];
  // Protocol cells whose snapshot is missing; their cells are skipped.
  missingProtocolIds: string[];
}

/**
 * Projects a pinned workbook version down to what a headless device can act
 * on: protocol cells (code inlined from the snapshot), command cells, and
 * question cells (answered at delivery time). Everything human-facing
 * (markdown, branches, outputs, macros) is dropped. Cell order is preserved.
 */
export function compileDevicePlan(cells: WorkbookCells, snapshots: EntitySnapshots): DevicePlan {
  const procedures: DeviceProcedure[] = [];
  const missingProtocolIds: string[] = [];

  for (const cell of cells) {
    if (cell.type === "protocol") {
      if (!(cell.payload.protocolId in snapshots.protocols)) {
        missingProtocolIds.push(cell.payload.protocolId);
        continue;
      }

      const snapshot = snapshots.protocols[cell.payload.protocolId];
      procedures.push({
        type: "protocol",
        protocolId: cell.payload.protocolId,
        name: cell.payload.name,
        family: snapshot.family,
        code: snapshot.code,
      });
    } else if (cell.type === "command") {
      procedures.push({
        type: "command",
        format: cell.payload.format,
        content: cell.payload.content,
        name: cell.payload.name,
      });
    } else if (cell.type === "question") {
      procedures.push({
        type: "question",
        id: cell.id,
        name: cell.name,
        kind: cell.question.kind,
        text: cell.question.text,
        ...(cell.question.kind === "multi_choice" ? { options: cell.question.options } : {}),
        required: cell.question.required,
        answer: cell.answer ?? null,
      });
    }
  }

  return { procedures, missingProtocolIds };
}

/**
 * Returns a config copy with question procedures answered, keyed by cell id.
 * Questions without an entry keep their current answer.
 */
export function applyPlanAnswers(
  config: DeviceOnboardingConfig,
  answers: Record<string, DeviceAnswer>,
): DeviceOnboardingConfig {
  return {
    ...config,
    experiments: config.experiments.map((experiment) => ({
      ...experiment,
      procedures: experiment.procedures.map((procedure) =>
        procedure.type === "question" && procedure.id in answers
          ? { ...procedure, answer: answers[procedure.id] }
          : procedure,
      ),
    })),
  };
}
