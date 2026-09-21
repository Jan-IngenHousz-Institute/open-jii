import { oc } from "@orpc/contract";
import { z } from "zod";

import {
  zAssistantDocumentIdInput,
  zAssistantKnowledgeCapabilities,
  zAssistantKnowledgeSearchInput,
  zAssistantKnowledgeSearchResponse,
  zAssistantPrivateDocument,
  zCorpusWork,
  zCorpusWorkIdInput,
  zCreateCorpusWorkInput,
  zListAssistantDocumentsInput,
  zListCorpusWorksInput,
  zReviewCorpusWorkInput,
} from "./assistant-knowledge.schema";

export const assistantKnowledgeContract = {
  getCapabilities: oc
    .route({ method: "GET", path: "/api/v1/assistant-knowledge/capabilities" })
    .output(zAssistantKnowledgeCapabilities),
  searchKnowledge: oc
    .route({ method: "POST", path: "/api/v1/assistant-knowledge/search" })
    .input(zAssistantKnowledgeSearchInput)
    .output(zAssistantKnowledgeSearchResponse),
  listCorpusWorks: oc
    .route({ method: "GET", path: "/api/v1/assistant-knowledge/corpus" })
    .input(zListCorpusWorksInput)
    .output(z.array(zCorpusWork)),
  getCorpusWork: oc
    .route({ method: "GET", path: "/api/v1/assistant-knowledge/corpus/{workId}" })
    .input(zCorpusWorkIdInput)
    .output(zCorpusWork),
  createCorpusWork: oc
    .route({ method: "POST", path: "/api/v1/assistant-knowledge/corpus", successStatus: 201 })
    .input(zCreateCorpusWorkInput)
    .output(zCorpusWork),
  parseCorpusWork: oc
    .route({ method: "POST", path: "/api/v1/assistant-knowledge/corpus/{workId}/parse" })
    .input(zCorpusWorkIdInput)
    .output(zCorpusWork),
  reviewCorpusWork: oc
    .route({ method: "POST", path: "/api/v1/assistant-knowledge/corpus/{workId}/review" })
    .input(zReviewCorpusWorkInput)
    .output(zCorpusWork),
  admitCorpusWork: oc
    .route({ method: "POST", path: "/api/v1/assistant-knowledge/corpus/{workId}/admit" })
    .input(zCorpusWorkIdInput)
    .output(zCorpusWork),
  removeCorpusWork: oc
    .route({ method: "DELETE", path: "/api/v1/assistant-knowledge/corpus/{workId}" })
    .input(zCorpusWorkIdInput)
    .output(zCorpusWork),
  listDocuments: oc
    .route({ method: "GET", path: "/api/v1/assistant-knowledge/documents" })
    .input(zListAssistantDocumentsInput)
    .output(z.array(zAssistantPrivateDocument)),
  getDocument: oc
    .route({ method: "GET", path: "/api/v1/assistant-knowledge/documents/{documentId}" })
    .input(zAssistantDocumentIdInput)
    .output(zAssistantPrivateDocument),
  parseDocument: oc
    .route({ method: "POST", path: "/api/v1/assistant-knowledge/documents/{documentId}/parse" })
    .input(zAssistantDocumentIdInput)
    .output(zAssistantPrivateDocument),
  deleteDocument: oc
    .route({ method: "DELETE", path: "/api/v1/assistant-knowledge/documents/{documentId}" })
    .input(zAssistantDocumentIdInput)
    .output(z.object({ deleted: z.literal(true) })),
};
