import { z } from "zod";

export const zAssistantKnowledgeSourceType = z.enum(["docs", "corpus", "document", "genie"]);
export type AssistantKnowledgeSourceType = z.infer<typeof zAssistantKnowledgeSourceType>;

export const zAssistantKnowledgeProviderState = z.enum([
  "available",
  "unconfigured",
  "unavailable",
]);

export const zAssistantKnowledgeCapabilityErrorCode = z.enum([
  "DATABRICKS_NOT_CONFIGURED",
  "DATABRICKS_AUTH_FAILED",
  "DOCUMENT_INTELLIGENCE_UNAVAILABLE",
  "DOCUMENT_TYPE_UNSUPPORTED",
  "DOCUMENT_TOO_LARGE",
  "DOCUMENT_NOT_UPLOADED",
  "DOCUMENT_PARSE_FAILED",
  "GENIE_NOT_CONFIGURED",
  "GENIE_DATASET_NOT_PUBLIC",
  "GENIE_TOOL_UNAVAILABLE",
  "DOCS_ROOT_UNAVAILABLE",
]);

export const zAssistantKnowledgeProviderCapability = z.object({
  state: zAssistantKnowledgeProviderState,
  code: zAssistantKnowledgeCapabilityErrorCode.nullable(),
  message: z.string().min(1).nullable(),
});

export const zAssistantKnowledgeCapabilities = z.object({
  canSearchDocs: z.boolean(),
  canSearchCorpus: z.boolean(),
  canUploadDocument: z.boolean(),
  canCurateCorpus: z.boolean(),
  canUseGenie: z.boolean(),
  providers: z.object({
    docs: zAssistantKnowledgeProviderCapability,
    documentIntelligence: zAssistantKnowledgeProviderCapability,
    genie: zAssistantKnowledgeProviderCapability,
  }),
});
export type AssistantKnowledgeCapabilities = z.infer<typeof zAssistantKnowledgeCapabilities>;

export const zAssistantKnowledgeSourceUrl = z
  .string()
  .url()
  .regex(/^https?:\/\//iu, "Source URLs must use HTTP or HTTPS");

export const zAssistantKnowledgeCitation = z.object({
  sourceType: zAssistantKnowledgeSourceType,
  sourceId: z.string().min(1),
  title: z.string().min(1),
  year: z.number().int().min(1000).max(9999).nullable(),
  page: z.number().int().positive().nullable(),
  route: z.string().min(1).nullable(),
  sourceUrl: zAssistantKnowledgeSourceUrl.nullable(),
  licenceId: z.string().min(1).nullable(),
});
export type AssistantKnowledgeCitation = z.infer<typeof zAssistantKnowledgeCitation>;

export const zAssistantKnowledgeHit = z.object({
  citation: zAssistantKnowledgeCitation,
  excerpt: z.string().min(1),
  score: z.number().min(0),
});
export type AssistantKnowledgeHit = z.infer<typeof zAssistantKnowledgeHit>;

export const zAssistantKnowledgeSearchInput = z.object({
  query: z.string().trim().min(2).max(500),
  organizationId: z.string().uuid().optional(),
  sourceTypes: z.array(zAssistantKnowledgeSourceType).min(1).max(4).optional(),
  topicTags: z.array(z.string().trim().min(1).max(64)).max(10).optional(),
  limit: z.number().int().min(1).max(20).default(8),
});
export type AssistantKnowledgeSearchInput = z.infer<typeof zAssistantKnowledgeSearchInput>;

export const zAssistantKnowledgeSearchResponse = z.object({
  hits: z.array(zAssistantKnowledgeHit),
  retrievalMode: z.enum(["lexical", "semantic", "hybrid"]),
  answerable: z.boolean(),
  warnings: z.array(z.string()),
});
export type AssistantKnowledgeSearchResponse = z.infer<typeof zAssistantKnowledgeSearchResponse>;

export const zCorpusRightsStatus = z.enum(["pending", "approved", "rejected"]);
export const zCorpusRightsBasis = z.enum([
  "open-access",
  "author-owned",
  "licensed",
  "public-domain",
  "authored-fixture",
]);

export const zCorpusRights = z.object({
  status: zCorpusRightsStatus,
  basis: zCorpusRightsBasis.nullable(),
  licenceId: z.string().trim().min(1).max(128).nullable(),
  licenceUrl: z.string().url().nullable(),
  attribution: z.string().trim().min(1).max(1000).nullable(),
  reviewedBy: z.string().uuid().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  externalPublicStatus: zCorpusRightsStatus,
  externalPublicReviewedBy: z.string().uuid().nullable(),
  externalPublicReviewedAt: z.string().datetime().nullable(),
});
export type CorpusRights = z.infer<typeof zCorpusRights>;

export const zCorpusWorkStatus = z.enum([
  "held",
  "uploaded",
  "parsing",
  "review",
  "active",
  "rejected",
  "removed",
  "failed",
]);

export const zAssistantParseElement = z.object({
  kind: z.enum(["text", "table", "figure", "heading", "other"]),
  page: z.number().int().positive(),
  content: z.string(),
  confidence: z.number().min(0).max(1).nullable(),
});
export type AssistantParseElement = z.infer<typeof zAssistantParseElement>;

export const zAssistantParse = z.object({
  provider: z.enum(["databricks-ai-parse-document", "authored-fixture"]),
  status: z.enum(["not-started", "parsing", "review", "accepted", "rejected", "failed"]),
  pages: z.number().int().nonnegative(),
  elements: z.array(zAssistantParseElement),
  averageConfidence: z.number().min(0).max(1).nullable(),
  reviewedBy: z.string().uuid().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  reviewNote: z.string().max(2000).nullable(),
  errorCode: zAssistantKnowledgeCapabilityErrorCode.nullable(),
  errorMessage: z.string().nullable(),
});
export type AssistantParse = z.infer<typeof zAssistantParse>;

export const zCorpusWork = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  title: z.string().min(1),
  authors: z.array(z.string().min(1)),
  year: z.number().int().min(1000).max(9999),
  doi: z.string().min(1).nullable(),
  sourceUrl: zAssistantKnowledgeSourceUrl.nullable(),
  topicTags: z.array(z.string().min(1)),
  fixture: z.boolean(),
  status: zCorpusWorkStatus,
  rights: zCorpusRights,
  parse: zAssistantParse,
  fileName: z.string().min(1).nullable(),
  createdBy: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  removedAt: z.string().datetime().nullable(),
});
export type CorpusWork = z.infer<typeof zCorpusWork>;

export const zCreateCorpusWorkInput = z.object({
  organizationId: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
  authors: z.array(z.string().trim().min(1).max(200)).min(1).max(50),
  year: z.number().int().min(1000).max(9999),
  doi: z.string().trim().min(1).max(256).optional(),
  sourceUrl: zAssistantKnowledgeSourceUrl.optional(),
  topicTags: z.array(z.string().trim().min(1).max(64)).max(20).default([]),
  rights: z
    .object({
      basis: zCorpusRightsBasis.optional(),
      licenceId: z.string().trim().min(1).max(128).optional(),
      licenceUrl: z.string().url().optional(),
      attribution: z.string().trim().min(1).max(1000).optional(),
    })
    .optional(),
});
export type CreateCorpusWorkInput = z.infer<typeof zCreateCorpusWorkInput>;

export const zCorpusWorkIdInput = z.object({ workId: z.string().uuid() });

export const zListCorpusWorksInput = z.object({
  organizationId: z.string().uuid().optional(),
  includeRemoved: z
    .union([z.boolean(), z.enum(["true", "false"]).transform((value) => value === "true")])
    .default(false),
});

export const zReviewCorpusWorkInput = zCorpusWorkIdInput.extend({
  parseDecision: z.enum(["accepted", "rejected"]),
  parseReviewNote: z.string().trim().max(2000).optional(),
  rightsDecision: zCorpusRightsStatus,
  externalPublicDecision: zCorpusRightsStatus.default("pending"),
  rights: z.object({
    basis: zCorpusRightsBasis,
    licenceId: z.string().trim().min(1).max(128),
    licenceUrl: z.string().url().nullable(),
    attribution: z.string().trim().min(1).max(1000),
  }),
});
export type ReviewCorpusWorkInput = z.infer<typeof zReviewCorpusWorkInput>;

export const zAssistantPrivateDocument = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  ownerUserId: z.string().uuid(),
  fileName: z.string().min(1),
  mediaType: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  parse: zAssistantParse,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AssistantPrivateDocument = z.infer<typeof zAssistantPrivateDocument>;

export const zListAssistantDocumentsInput = z.object({
  organizationId: z.string().uuid().optional(),
});

export const zAssistantDocumentIdInput = z.object({ documentId: z.string().uuid() });

export const zAssistantKnowledgeUploadReceipt = z.object({
  id: z.string().uuid(),
  fileName: z.string().min(1),
  mediaType: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  status: z.enum(["uploaded", "held"]),
});
export type AssistantKnowledgeUploadReceipt = z.infer<typeof zAssistantKnowledgeUploadReceipt>;
