import { ZodToJsonSchemaConverter } from "@orpc/zod";
import { z } from "zod";

import { zCreateExperimentBody, zCreateExperimentBodyBase } from "../experiment/experiment.schema";
import { zCreateExperimentVisualizationBody } from "../experiment/visualizations/experiment-visualizations.schema";
import type { CreateExperimentVisualizationBody } from "../experiment/visualizations/experiment-visualizations.schema";
import { zCreateMacroRequestBody } from "../macro/macro.schema";
import { ProtocolJsonSchema } from "../protocol/protocol-validator";
import { zCreateProtocolRequestBody } from "../protocol/protocol.schema";
import { zCreateWorkbookRequestBody } from "../workbook/workbook.schema";

export const zAssistantEntityType = z.enum([
  "experiment",
  "protocol",
  "workbook",
  "macro",
  "dashboard",
]);

export const zAssistantContext = z.object({
  route: z.string().trim().min(1).max(1024),
  locale: z.string().trim().min(2).max(16).optional(),
  entity: z
    .object({
      type: zAssistantEntityType,
      id: z.string().uuid(),
      title: z.string().trim().min(1).max(255).optional(),
    })
    .optional(),
});

export const zAssistantSource = z.object({
  id: z.string().min(1),
  type: z.enum(["entity", "docs", "literature", "public"]),
  title: z.string().min(1),
  url: z.string().optional(),
  excerpt: z.string().max(1000).optional(),
  entityType: zAssistantEntityType.optional(),
  entityId: z.string().uuid().optional(),
  year: z.number().int().min(1000).max(9999).optional(),
  page: z.number().int().positive().optional(),
});

export const zAssistantToolCall = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["completed", "failed"]),
  summary: z.string(),
  error: z.string().optional(),
  result: z.unknown().optional(),
});

export const zAssistantRating = z.enum(["up", "down"]);

export const zAssistantMessage = z.object({
  id: z.string().uuid(),
  threadId: z.string().uuid(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  sources: z.array(zAssistantSource),
  toolCalls: z.array(zAssistantToolCall),
  draftIds: z.array(z.string().uuid()),
  rating: zAssistantRating.nullable(),
  createdAt: z.string().datetime(),
});

export const zAssistantThread = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  context: zAssistantContext.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type AssistantVisualizationDraftValue = CreateExperimentVisualizationBody & {
  experimentId: string;
};

export const zAssistantVisualizationDraftValue: z.ZodType<AssistantVisualizationDraftValue> =
  zCreateExperimentVisualizationBody.extend({ experimentId: z.string().uuid() });

export const ASSISTANT_PYTHON_MACRO_GUIDANCE =
  'Python source is a function body: the runtime wraps and calls it. Use a top-level return of a JSON-serializable dict, or assign keys on the provided output dict, such as output["sample"] = value; do not rebind output. Defining main(json, ctx) alone does nothing; if you define a helper, call it and return its result. json is the direct measurement. ctx and nested context objects are read-only mappings, not dict instances; use .get(), indexing or membership. Never require isinstance(ctx, dict) or isinstance(ctx[key], dict), and do not mutate ctx. Context lists are read-only tuples. Preloaded modules are np (numpy), pd (pandas), scipy and json_module; helpers include MathMEAN, GetProtocolByLabel and TransformTrace. Each row has a one-second execution limit. The restricted builtins omit bool, type, hasattr and __import__; do not call them or import modules. Numeric checks can use isinstance(x, (int, float)) and x is not True and x is not False. Example body: return {"sample": ctx.get("sample_id", {}).get("answer")}';

export const zAssistantMacroDraftValue = zCreateMacroRequestBody.extend({
  // Omitted on existing drafts whose code already uses the domain's base64 format.
  codeEncoding: z.literal("utf8").optional(),
});

export const zAssistantDraftPayload = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("experiment"), value: zCreateExperimentBody }),
  z.object({ kind: z.literal("protocol"), value: zCreateProtocolRequestBody }),
  z.object({ kind: z.literal("workbook"), value: zCreateWorkbookRequestBody }),
  z.object({ kind: z.literal("macro"), value: zAssistantMacroDraftValue }),
  z.object({
    kind: z.literal("visualization"),
    value: zAssistantVisualizationDraftValue,
  }),
]);

const zDraftDescription = z
  .string()
  .trim()
  .min(40, "Describe the research plan and what this resource contains")
  .max(12_000)
  .describe(
    "Persist the substantive research plan here: aim, treatments, sampling, replication, metadata to collect and limitations. Only these written details are saved; this does not create metadata fields.",
  );

const zDraftProtocolCode = zCreateProtocolRequestBody.shape.code
  .refine(
    (code) => code !== null && typeof code === "object" && Object.keys(code).length > 0,
    "Provide a nonempty device JSON object or array",
  )
  .refine(
    (code) => JSON.stringify(code).length <= 32_000,
    "Protocol JSON must be at most 32000 characters",
  )
  .describe(
    'Device JSON, not prose. For MultispeQ use an array of protocol sets, for example [{"environmental":[["light_intensity"]]}]. A structurally valid recipe still needs validation on the actual equipment.',
  );

const zDraftWorkbookCells = zCreateWorkbookRequestBody.shape.cells
  .unwrap()
  .superRefine((cells, ctx) => {
    if (cells.length < 1 || cells.length > 30) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide 1 to 30 authored cells" });
    }
    const ids = new Set<string>();
    for (const [index, cell] of cells.entries()) {
      if (ids.has(cell.id))
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "id"],
          message: "Cell IDs must be unique",
        });
      ids.add(cell.id);
      if (cell.type === "output")
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index],
          message: "Do not invent output cells; outputs come from execution",
        });
      if (cell.type === "markdown" && !cell.content.trim())
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "content"],
          message: "Instructions cannot be empty",
        });
      if (cell.type === "question" && !cell.question.text.trim())
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "question", "text"],
          message: "Question text cannot be empty",
        });
    }
  })
  .describe(
    "1 to 30 cells in execution order. Include instructions and named questions for collection metadata. Protocol and macro cells must reference confirmed readable entities, never invented IDs. Do not author output cells.",
  );

export const assistantDraftValueSchemas = {
  experiment: zCreateExperimentBodyBase
    .pick({
      name: true,
      description: true,
      organizationId: true,
      visibility: true,
      workbookId: true,
    })
    .extend({ description: zDraftDescription })
    .strict()
    .pipe(zCreateExperimentBody),
  protocol: zCreateProtocolRequestBody
    .extend({ description: zDraftDescription, code: zDraftProtocolCode })
    .strict()
    .superRefine((value, ctx) => {
      if (value.family !== "multispeq") return;
      const result = ProtocolJsonSchema.safeParse(value.code);
      if (!result.success) {
        for (const issue of result.error.issues)
          ctx.addIssue({ ...issue, path: ["code", ...issue.path] });
      } else if (
        result.data.some((entry) =>
          (entry._protocol_set_ ?? [entry]).some(
            (set) => !Object.keys(set).some((key) => key !== "label"),
          ),
        )
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["code"],
          message: "Protocol sets must contain device commands, not only labels",
        });
      }
    }),
  workbook: zCreateWorkbookRequestBody
    .extend({ description: zDraftDescription, cells: zDraftWorkbookCells })
    .strict(),
  macro: zAssistantMacroDraftValue
    .extend({
      description: zDraftDescription,
      language: z.literal("python"),
      code: z
        .string()
        .min(1)
        .max(32_000)
        .refine((code) => code.trim().length > 0, "Macro source cannot be blank")
        .describe(
          `Readable source text, not base64. Code is saved only after confirmation and is not executed by the assistant. ${ASSISTANT_PYTHON_MACRO_GUIDANCE}`,
        ),
      codeEncoding: z.literal("utf8"),
    })
    .strict(),
  visualization: zAssistantVisualizationDraftValue,
};

// Creation-only rules must not prevent reading or confirming older saved drafts.
export const zAssistantNewDraftPayload = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("experiment"), value: assistantDraftValueSchemas.experiment }),
    z.object({ kind: z.literal("protocol"), value: assistantDraftValueSchemas.protocol }),
    z.object({ kind: z.literal("workbook"), value: assistantDraftValueSchemas.workbook }),
    z.object({ kind: z.literal("macro"), value: assistantDraftValueSchemas.macro }),
    z.object({ kind: z.literal("visualization"), value: assistantDraftValueSchemas.visualization }),
  ])
  .refine(
    (payload) => JSON.stringify(payload).length <= 64_000,
    "Draft payload must be at most 64000 characters",
  );

export function assistantDraftValueJsonSchemas() {
  const converter = new ZodToJsonSchemaConverter({ maxStructureDepth: 20 });
  return Object.entries(assistantDraftValueSchemas).map(([kind, schema]) => ({
    ...converter.convert(schema, { strategy: "input" })[1],
    title: kind,
  }));
}

export const zAssistantCreatedEntity = z.object({
  type: z.enum(["experiment", "protocol", "workbook", "macro", "visualization"]),
  id: z.string().uuid(),
  name: z.string(),
  url: z.string(),
});

export const zAssistantDraft = z.object({
  id: z.string().uuid(),
  threadId: z.string().uuid(),
  messageId: z.string().uuid().nullable(),
  kind: z.enum(["experiment", "protocol", "workbook", "macro", "visualization"]),
  status: z.enum(["pending", "confirming", "confirmed", "discarded"]),
  payload: zAssistantDraftPayload,
  source: zAssistantSource.nullable(),
  createdEntity: zAssistantCreatedEntity.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zAssistantQuota = z.object({
  dailyTokenLimit: z.number().int().positive(),
  tokensUsed: z.number().int().nonnegative(),
  tokensRemaining: z.number().int().nonnegative(),
  resetsAt: z.string().datetime(),
  exhausted: z.boolean(),
});

export const zAssistantUsageTotals = z.object({
  turns: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  toolCalls: z.number().int().nonnegative(),
  approvals: z.number().int().nonnegative(),
  discards: z.number().int().nonnegative(),
  ratingsUp: z.number().int().nonnegative(),
  ratingsDown: z.number().int().nonnegative(),
  starterCopies: z.number().int().nonnegative(),
});

export const zAssistantChatInput = z.object({
  threadId: z.string().uuid().optional(),
  message: z.string().trim().min(1).max(10_000),
  context: zAssistantContext.optional(),
  clientRequestId: z.string().uuid().optional(),
});

export const zAssistantChatResponse = z.object({
  thread: zAssistantThread,
  userMessage: zAssistantMessage,
  assistantMessage: zAssistantMessage,
  drafts: z.array(zAssistantDraft),
  quota: zAssistantQuota,
});

export const zAssistantChatEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("started"),
    thread: zAssistantThread,
    userMessage: zAssistantMessage,
    quota: zAssistantQuota,
  }),
  z.object({ type: z.literal("tool"), toolCall: zAssistantToolCall }),
  z.object({ type: z.literal("draft"), draft: zAssistantDraft }),
  z.object({ type: z.literal("text-delta"), delta: z.string().min(1) }),
  z.object({ type: z.literal("done"), result: zAssistantChatResponse }),
]);

export const zAssistantCursorInput = z.object({
  cursor: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
});

export const zAssistantThreadList = z.object({
  items: z.array(zAssistantThread),
  nextCursor: z.string().datetime().nullable(),
});

export const zAssistantThreadIdInput = z.object({ threadId: z.string().uuid() });

export const zAssistantThreadDetail = z.object({
  thread: zAssistantThread,
  messages: z.array(zAssistantMessage),
  drafts: z.array(zAssistantDraft),
});

export const zRateAssistantMessageInput = z.object({
  threadId: z.string().uuid(),
  messageId: z.string().uuid(),
  rating: zAssistantRating.nullable(),
});

export const zAssistantDraftIdInput = z.object({ draftId: z.string().uuid() });

export const zUpdateAssistantDraftInput = zAssistantDraftIdInput.extend({
  payload: zAssistantDraftPayload,
});

export const zConfirmAssistantDraftResponse = z.object({
  draft: zAssistantDraft,
  created: zAssistantCreatedEntity,
});

export const zAssistantUsageResponse = z.object({
  quota: zAssistantQuota,
  totals: zAssistantUsageTotals,
});

export const zStarterType = z.enum(["experiment", "protocol", "workbook", "macro"]);

export const zAssistantStarter = z.object({
  id: z.string().uuid(),
  type: zStarterType,
  name: z.string(),
  description: z.string().nullable(),
  ownerName: z.string().nullable(),
  curated: z.boolean(),
  collectionNames: z.array(z.string()),
  reuseCount: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
  url: z.string(),
});

export const zListAssistantStartersInput = z.object({
  cursor: z.string().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
  query: z.string().trim().min(1).max(200).optional(),
  type: zStarterType.optional(),
  sort: z.enum(["reuse", "updated"]).optional().default("updated"),
});

export const zAssistantStarterList = z.object({
  items: z.array(zAssistantStarter),
  nextCursor: z.string().nullable(),
});

export const zCopyAssistantStarterInput = z.object({
  starterId: z.string().uuid(),
  organizationId: z.string().uuid().optional(),
});

export const zCopyAssistantStarterResponse = zAssistantCreatedEntity.extend({
  derivedFrom: z.object({ type: zStarterType, id: z.string().uuid() }),
});

export const zAssistantMetricsInput = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export const zAssistantMetricPoint = z.object({
  date: z.string(),
  totals: zAssistantUsageTotals,
});

export const zAssistantMetricsResponse = z.object({
  totals: zAssistantUsageTotals,
  daily: z.array(zAssistantMetricPoint),
  dailyTokenLimit: z.number().int().positive(),
});

export const zSetAssistantDailyBudgetInput = z.object({
  dailyTokens: z.number().int().min(1000).max(10_000_000),
});

export const zAssistantStarterCollection = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).nullable(),
  sortOrder: z.number().int(),
  starterIds: z.array(z.string().uuid()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const zUpsertAssistantStarterCollectionInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const zSetAssistantStarterCollectionItemsInput = z.object({
  collectionId: z.string().uuid(),
  starterIds: z.array(z.string().uuid()).max(200),
});

export type AssistantContext = z.infer<typeof zAssistantContext>;
export type AssistantSource = z.infer<typeof zAssistantSource>;
export type AssistantToolCall = z.infer<typeof zAssistantToolCall>;
export type AssistantMessage = z.infer<typeof zAssistantMessage>;
export type AssistantThread = z.infer<typeof zAssistantThread>;
export type AssistantDraftPayload = z.infer<typeof zAssistantDraftPayload>;
export type AssistantCreatedEntity = z.infer<typeof zAssistantCreatedEntity>;
export type AssistantDraft = z.infer<typeof zAssistantDraft>;
export type AssistantQuota = z.infer<typeof zAssistantQuota>;
export type AssistantUsageTotals = z.infer<typeof zAssistantUsageTotals>;
export type AssistantChatInput = z.infer<typeof zAssistantChatInput>;
export type AssistantChatResponse = z.infer<typeof zAssistantChatResponse>;
export type AssistantChatEvent = z.infer<typeof zAssistantChatEvent>;
export type AssistantStarter = z.infer<typeof zAssistantStarter>;
export type AssistantStarterCollection = z.infer<typeof zAssistantStarterCollection>;
