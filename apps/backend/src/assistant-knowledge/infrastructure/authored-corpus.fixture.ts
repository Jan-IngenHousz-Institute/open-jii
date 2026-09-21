import type { StoredCorpusWork } from "../core/assistant-knowledge.models";

const FIXTURE_CREATED_AT = "2026-09-21T00:00:00.000Z";

/**
 * Synthetic, repository-authored material for local demonstrations. It is not a
 * published paper and must never be represented as one.
 */
export const AUTHORED_CORPUS_FIXTURE: StoredCorpusWork = {
  id: "00000000-0000-4000-8000-000000000101",
  organizationId: "00000000-0000-4000-8000-000000000102",
  title: "openJII development fixture: Photosynthetic induction measurements",
  authors: ["openJII development team"],
  year: 2026,
  doi: null,
  sourceUrl: null,
  topicTags: ["photosynthesis", "photosynthetic induction", "gas exchange"],
  fixture: true,
  status: "active",
  rights: {
    status: "approved",
    basis: "authored-fixture",
    licenceId: "AUTHORED-DEVELOPMENT-FIXTURE",
    licenceUrl: null,
    attribution: "Synthetic demonstration text authored for the openJII development PoC.",
    reviewedBy: "00000000-0000-4000-8000-000000000103",
    reviewedAt: FIXTURE_CREATED_AT,
    externalPublicStatus: "pending",
    externalPublicReviewedBy: null,
    externalPublicReviewedAt: null,
  },
  parse: {
    provider: "authored-fixture",
    status: "accepted",
    pages: 2,
    averageConfidence: 1,
    reviewedBy: "00000000-0000-4000-8000-000000000103",
    reviewedAt: FIXTURE_CREATED_AT,
    reviewNote: "Authored fixture. No machine parse was performed.",
    errorCode: null,
    errorMessage: null,
    elements: [
      {
        kind: "text",
        page: 1,
        confidence: 1,
        content:
          "Photosynthetic induction measurements should record the dark-to-light transition and the light intensity used for induction. Keep leaf temperature, carbon dioxide concentration, humidity, and airflow stable so the response can be compared across leaves.",
      },
      {
        kind: "text",
        page: 2,
        confidence: 1,
        content:
          "Report the measurement interval and the criterion used to define steady state. A short interval captures the fast opening response, while the full trace is needed to distinguish stomatal limitation from biochemical activation.",
      },
    ],
  },
  fileName: null,
  createdBy: "00000000-0000-4000-8000-000000000103",
  createdAt: FIXTURE_CREATED_AT,
  updatedAt: FIXTURE_CREATED_AT,
  removedAt: null,
  localFilePath: null,
  databricksFilePath: null,
};
