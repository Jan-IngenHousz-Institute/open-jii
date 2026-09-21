import { eventIterator, oc } from "@orpc/contract";
import { z } from "zod";

import {
  zAssistantChatInput,
  zAssistantChatEvent,
  zAssistantCursorInput,
  zAssistantDraft,
  zAssistantDraftIdInput,
  zAssistantMessage,
  zAssistantMetricsInput,
  zAssistantMetricsResponse,
  zAssistantStarterCollection,
  zAssistantStarterList,
  zAssistantThreadDetail,
  zAssistantThreadIdInput,
  zAssistantThreadList,
  zAssistantUsageResponse,
  zConfirmAssistantDraftResponse,
  zCopyAssistantStarterInput,
  zCopyAssistantStarterResponse,
  zListAssistantStartersInput,
  zRateAssistantMessageInput,
  zSetAssistantDailyBudgetInput,
  zSetAssistantStarterCollectionItemsInput,
  zUpdateAssistantDraftInput,
  zUpsertAssistantStarterCollectionInput,
} from "./assistant.schema";

export const assistantContract = {
  chat: oc
    .route({ method: "POST", path: "/api/v1/assistant/chat", successStatus: 200 })
    .input(zAssistantChatInput)
    .output(eventIterator(zAssistantChatEvent)),
  listThreads: oc
    .route({ method: "GET", path: "/api/v1/assistant/threads", successStatus: 200 })
    .input(zAssistantCursorInput)
    .output(zAssistantThreadList),
  getThread: oc
    .route({ method: "GET", path: "/api/v1/assistant/threads/{threadId}", successStatus: 200 })
    .input(zAssistantThreadIdInput)
    .output(zAssistantThreadDetail),
  rateMessage: oc
    .route({
      method: "PUT",
      path: "/api/v1/assistant/threads/{threadId}/messages/{messageId}/rating",
      successStatus: 200,
    })
    .input(zRateAssistantMessageInput)
    .output(zAssistantMessage),
  updateDraft: oc
    .route({ method: "PUT", path: "/api/v1/assistant/drafts/{draftId}", successStatus: 200 })
    .input(zUpdateAssistantDraftInput)
    .output(zAssistantDraft),
  confirmDraft: oc
    .route({
      method: "POST",
      path: "/api/v1/assistant/drafts/{draftId}/confirm",
      successStatus: 201,
    })
    .input(zAssistantDraftIdInput)
    .output(zConfirmAssistantDraftResponse),
  discardDraft: oc
    .route({
      method: "POST",
      path: "/api/v1/assistant/drafts/{draftId}/discard",
      successStatus: 200,
    })
    .input(zAssistantDraftIdInput)
    .output(zAssistantDraft),
  getUsage: oc
    .route({ method: "GET", path: "/api/v1/assistant/usage", successStatus: 200 })
    .input(z.object({}))
    .output(zAssistantUsageResponse),
  listStarters: oc
    .route({ method: "GET", path: "/api/v1/assistant/starters", successStatus: 200 })
    .input(zListAssistantStartersInput)
    .output(zAssistantStarterList),
  copyStarter: oc
    .route({
      method: "POST",
      path: "/api/v1/assistant/starters/{starterId}/copy",
      successStatus: 201,
    })
    .input(zCopyAssistantStarterInput)
    .output(zCopyAssistantStarterResponse),
  listMetrics: oc
    .route({ method: "GET", path: "/api/v1/assistant/operator/metrics", successStatus: 200 })
    .input(zAssistantMetricsInput)
    .output(zAssistantMetricsResponse),
  setDailyBudget: oc
    .route({
      method: "PUT",
      path: "/api/v1/assistant/operator/daily-budget",
      successStatus: 200,
    })
    .input(zSetAssistantDailyBudgetInput)
    .output(z.object({ dailyTokenLimit: z.number().int().positive() })),
  listStarterCollections: oc
    .route({
      method: "GET",
      path: "/api/v1/assistant/operator/starter-collections",
      successStatus: 200,
    })
    .input(z.object({}))
    .output(z.array(zAssistantStarterCollection)),
  upsertStarterCollection: oc
    .route({
      method: "PUT",
      path: "/api/v1/assistant/operator/starter-collections",
      successStatus: 200,
    })
    .input(zUpsertAssistantStarterCollectionInput)
    .output(zAssistantStarterCollection),
  setStarterCollectionItems: oc
    .route({
      method: "PUT",
      path: "/api/v1/assistant/operator/starter-collections/{collectionId}/items",
      successStatus: 200,
    })
    .input(zSetAssistantStarterCollectionItemsInput)
    .output(zAssistantStarterCollection),
};
