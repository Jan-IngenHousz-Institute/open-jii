import { z } from "zod";

import { zExperimentQuestionKind } from "./experiment.schema";

// The aliases occur in saved flows from older mobile builds.
export const zMeasurementQuestionKind = z.union([
  zExperimentQuestionKind,
  z.enum(["text", "single_choice"]),
]);

export const zMeasurementQuestion = z.object({
  question_label: z.string(),
  question_text: z.string(),
  question_kind: zMeasurementQuestionKind.optional(),
  // Keep the input string for old clients and queued measurements. The lakehouse
  // converts Number answers using their kind, rather than guessing from text.
  question_answer: z.string().nullable(),
});
