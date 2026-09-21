import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { StatusCodes } from "http-status-codes";

import { FEATURE_FLAGS } from "@repo/analytics";
import {
  zAssistantDraftPayload,
  zAssistantNewDraftPayload,
} from "@repo/api/domains/assistant/assistant.schema";
import type {
  AssistantChatEvent,
  AssistantContext,
  AssistantCreatedEntity,
  AssistantDraft,
  AssistantSource,
} from "@repo/api/domains/assistant/assistant.schema";

import { AuthorizationService } from "../../authorization/authorization.service";
import { AnalyticsAdapter } from "../../common/modules/analytics/analytics.adapter";
import { AppError } from "../../common/utils/fp-utils";
import { AttachWorkbookUseCase } from "../../experiments/application/use-cases/attach-workbook/attach-workbook";
import { CreateExperimentUseCase } from "../../experiments/application/use-cases/create-experiment/create-experiment";
import { CreateExperimentVisualizationUseCase } from "../../experiments/application/use-cases/experiment-visualizations/create-experiment-visualization";
import { CreateMacroUseCase } from "../../macros/application/use-cases/create-macro/create-macro";
import { CreateProtocolUseCase } from "../../protocols/application/use-cases/create-protocol/create-protocol";
import type { CreateProtocolDto } from "../../protocols/core/models/protocol.model";
import { CreateWorkbookUseCase } from "../../workbooks/application/use-cases/create-workbook/create-workbook";
import type { CreateWorkbookDto } from "../../workbooks/core/models/workbook.model";
import { AssistantModelService } from "./assistant-model.service";
import { AssistantToolService, getAssistantDraftReadReferences } from "./assistant-tool.service";
import type { DraftProposal } from "./assistant-tool.service";
import { AssistantRepository } from "./assistant.repository";

interface ChatInput {
  threadId?: string;
  message: string;
  context?: AssistantContext;
  clientRequestId?: string;
}

@Injectable()
export class AssistantService {
  constructor(
    private readonly config: ConfigService,
    private readonly analytics: AnalyticsAdapter,
    private readonly authorization: AuthorizationService,
    private readonly repository: AssistantRepository,
    private readonly model: AssistantModelService,
    private readonly tools: AssistantToolService,
    private readonly createExperiment: CreateExperimentUseCase,
    private readonly createVisualization: CreateExperimentVisualizationUseCase,
    private readonly createProtocol: CreateProtocolUseCase,
    private readonly createWorkbook: CreateWorkbookUseCase,
    private readonly createMacro: CreateMacroUseCase,
    private readonly attachWorkbook: AttachWorkbookUseCase,
  ) {}

  async *chat(
    user: { id: string; email?: string | null },
    input: ChatInput,
  ): AsyncGenerator<AssistantChatEvent> {
    await this.assertEnabled(user);
    await this.assertContextReadable(user.id, input.context);
    const reservation = await this.repository.reserveTurnBudget(
      user.id,
      this.defaultDailyLimit(),
      this.maxTotalTokens(),
    );
    if (!reservation) {
      throw new AppError(
        "Your assistant budget for today has been used",
        "ASSISTANT_QUOTA_EXCEEDED",
        StatusCodes.TOO_MANY_REQUESTS,
      );
    }
    let reservationSettled = false;
    let modelStarted = false;
    let threadId: string | undefined;
    try {
      const thread = input.threadId
        ? await this.repository.getThread(user.id, input.threadId)
        : await this.repository.createThread(
            user.id,
            this.title(input.message),
            input.context ?? null,
          );
      if (!thread) throw AppError.notFound("Assistant thread not found");
      threadId = thread.id;
      if (input.context) await this.repository.touchThread(thread.id, input.context);

      const userMessage = await this.repository.createMessage({
        threadId: thread.id,
        role: "user",
        content: input.message,
        clientRequestId: input.clientRequestId,
      });
      yield { type: "started", thread, userMessage, quota: reservation.quota };

      const history = await this.repository.listMessages(thread.id);
      const modelHistory = history.map((message, index) => ({
        role: message.role,
        content:
          index === history.length - 1 && input.context
            ? `${this.contextPrefix(input.context)}${message.content}`
            : message.content,
      }));
      const sources = new Map<string, AssistantSource>();
      const proposals: DraftProposal[] = [];
      const queued: AssistantChatEvent[] = [];
      let wake: (() => void) | undefined;
      let settled = false;
      let runError: unknown;
      let runResult: Awaited<ReturnType<AssistantModelService["run"]>> | undefined;

      const push = (event: AssistantChatEvent) => {
        queued.push(event);
        wake?.();
        wake = undefined;
      };
      modelStarted = true;
      const runPromise = this.model
        .run(
          modelHistory,
          async (name, args, callId) => {
            const result = await this.tools.execute(user.id, name, args, callId);
            for (const source of result.sources) sources.set(source.id, source);
            if (result.draft) proposals.push(result.draft);
            push({ type: "tool", toolCall: result.toolCall });
            await this.repository.recordUsage({
              userId: user.id,
              threadId: thread.id,
              eventType: "tool_call",
              entityType: input.context?.entity?.type,
              metadata: { tool: name, status: result.toolCall.status },
            });
            return result;
          },
          {
            maxTotalTokens: reservation.reservedTokens,
            maxOutputTokens: Math.min(
              reservation.reservedTokens,
              this.config.get<number>("assistant.maxOutputTokens") ?? 2_000,
            ),
          },
        )
        .then((result) => {
          runResult = result;
        })
        .catch((error: unknown) => {
          runError = error;
        })
        .finally(() => {
          settled = true;
          wake?.();
          wake = undefined;
        });

      // `settled` is mutated by the asynchronous model completion callbacks above.
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (!settled || queued.length > 0) {
        const event = queued.shift();
        if (event) {
          yield event;
        } else {
          await new Promise<void>((resolve) => {
            wake = resolve;
          });
        }
      }
      await runPromise;
      if (runError) {
        throw runError instanceof Error
          ? runError
          : AppError.internal("Assistant model failed without an error response");
      }
      if (!runResult) throw AppError.internal("Assistant model did not return a result");
      await this.repository.reconcileTurnBudget({
        reservationId: reservation.reservationId,
        userId: user.id,
        threadId: thread.id,
        entityType: input.context?.entity?.type,
        inputTokens: runResult.inputTokens,
        outputTokens: runResult.outputTokens,
        usageComplete: runResult.usageComplete,
        status: "completed",
      });
      reservationSettled = true;

      let assistantMessage = await this.repository.createMessage({
        threadId: thread.id,
        role: "assistant",
        content: runResult.content,
        sources: [...sources.values()],
        toolCalls: runResult.toolCalls,
        inputTokens: runResult.inputTokens,
        outputTokens: runResult.outputTokens,
      });
      const drafts: AssistantDraft[] = [];
      for (const proposal of proposals) {
        const draft = await this.repository.createDraft({
          threadId: thread.id,
          messageId: assistantMessage.id,
          userId: user.id,
          payload: proposal.payload,
          source: proposal.source,
        });
        drafts.push(draft);
        yield { type: "draft", draft };
      }
      assistantMessage = { ...assistantMessage, draftIds: drafts.map((draft) => draft.id) };
      await this.repository.touchThread(thread.id, input.context);
      const quotaAfter = await this.quota(user.id);
      for (const delta of this.textDeltas(runResult.content)) {
        yield { type: "text-delta", delta };
      }
      yield {
        type: "done",
        result: {
          thread: (await this.repository.getThread(user.id, thread.id)) ?? thread,
          userMessage,
          assistantMessage,
          drafts,
          quota: quotaAfter,
        },
      };
    } catch (error) {
      if (!reservationSettled) {
        const accounted = this.usageFromError(error);
        await this.repository.reconcileTurnBudget({
          reservationId: reservation.reservationId,
          userId: user.id,
          threadId,
          entityType: input.context?.entity?.type,
          inputTokens: accounted.inputTokens,
          outputTokens: accounted.outputTokens,
          usageComplete: modelStarted ? accounted.usageComplete : true,
          status: "failed",
        });
        reservationSettled = true;
      }
      throw error;
    } finally {
      if (!reservationSettled) {
        await this.repository.reconcileTurnBudget({
          reservationId: reservation.reservationId,
          userId: user.id,
          threadId,
          entityType: input.context?.entity?.type,
          inputTokens: 0,
          outputTokens: 0,
          usageComplete: !modelStarted,
          status: "failed",
        });
        reservationSettled = true;
      }
    }
  }

  async listThreads(user: { id: string; email?: string | null }, cursor?: string, limit = 30) {
    await this.assertEnabled(user);
    return this.repository.listThreads(user.id, cursor, limit);
  }

  async getThread(user: { id: string; email?: string | null }, threadId: string) {
    await this.assertEnabled(user);
    const thread = await this.repository.getThread(user.id, threadId);
    if (!thread) throw AppError.notFound("Assistant thread not found");
    const [messages, drafts] = await Promise.all([
      this.repository.listMessages(threadId),
      this.repository.listDrafts(user.id, threadId),
    ]);
    return { thread, messages, drafts };
  }

  async rateMessage(
    user: { id: string; email?: string | null },
    threadId: string,
    messageId: string,
    rating: "up" | "down" | null,
  ) {
    await this.assertEnabled(user);
    const message = await this.repository.rateMessage(user.id, threadId, messageId, rating);
    if (!message) throw AppError.notFound("Assistant message not found");
    if (rating) {
      await this.repository.recordUsage({
        userId: user.id,
        threadId,
        eventType: rating === "up" ? "rating_up" : "rating_down",
      });
    }
    return message;
  }

  async updateDraft(
    user: { id: string; email?: string | null },
    draftId: string,
    rawPayload: unknown,
  ) {
    await this.assertEnabled(user);
    const existing = await this.repository.getDraft(user.id, draftId);
    if (existing?.status !== "pending") {
      throw AppError.conflict("Draft is not pending", "DRAFT_NOT_PENDING");
    }
    const schema = zAssistantNewDraftPayload.safeParse(existing.payload).success
      ? zAssistantNewDraftPayload
      : zAssistantDraftPayload;
    const payload = this.privateByDefault(schema.parse(rawPayload));
    const draft = await this.repository.updateDraft(user.id, draftId, payload);
    if (!draft) throw AppError.conflict("Draft is not pending", "DRAFT_NOT_PENDING");
    return draft;
  }

  async confirmDraft(user: { id: string; email?: string | null }, draftId: string) {
    await this.assertEnabled(user);
    const draft = await this.repository.claimDraft(user.id, draftId);
    if (!draft) {
      const existing = await this.repository.getDraft(user.id, draftId);
      if (existing?.status === "confirmed" && existing.createdEntity) {
        return { draft: existing, created: existing.createdEntity };
      }
      if (existing?.status === "confirming" && existing.createdEntity) {
        const payload = this.privateByDefault(zAssistantDraftPayload.parse(existing.payload));
        if (payload.kind === "experiment" && payload.value.workbookId) {
          await this.assertDraftCreationAllowed(user.id, existing.source, payload);
          await this.attachCreatedExperimentWorkbook(user.id, payload, existing.createdEntity);
        }
        const recovered = await this.repository.finishDraft(
          user.id,
          draftId,
          "confirmed",
          existing.createdEntity,
        );
        if (recovered) {
          await this.repository.recordUsage({
            userId: user.id,
            threadId: existing.threadId,
            organizationId:
              "organizationId" in payload.value ? payload.value.organizationId : undefined,
            eventType: "draft_confirmed",
            entityType: existing.createdEntity.type,
          });
          return { draft: recovered, created: existing.createdEntity };
        }
      }
      throw AppError.conflict(
        existing?.status === "confirming"
          ? "Draft confirmation is already in progress"
          : "Draft is not pending",
        "DRAFT_NOT_PENDING",
      );
    }
    let creationStarted = false;
    try {
      const payload = this.privateByDefault(zAssistantDraftPayload.parse(draft.payload));
      const organizationId = await this.assertDraftCreationAllowed(user.id, draft.source, payload);
      creationStarted = true;
      const created = await this.createFromPayload(user.id, payload);
      // Persist the ID before attachment so a failed snapshot/flow can retry without another create.
      const recorded = await this.repository.recordDraftCreated(user.id, draftId, created);
      if (!recorded) {
        throw AppError.conflict("Draft creation could not be recorded", "DRAFT_NOT_PENDING");
      }
      await this.attachCreatedExperimentWorkbook(user.id, payload, created);
      const confirmed = await this.repository.finishDraft(user.id, draftId, "confirmed", created);
      if (!confirmed)
        throw AppError.conflict("Draft confirmation was interrupted", "DRAFT_NOT_PENDING");
      await this.repository.recordUsage({
        userId: user.id,
        threadId: draft.threadId,
        organizationId,
        eventType: "draft_confirmed",
        entityType: created.type,
      });
      return { draft: confirmed, created };
    } catch (error) {
      if (!creationStarted) await this.repository.releaseDraftClaim(user.id, draftId);
      throw error;
    }
  }

  async discardDraft(user: { id: string; email?: string | null }, draftId: string) {
    await this.assertEnabled(user);
    const draft = await this.repository.finishDraft(user.id, draftId, "discarded");
    if (!draft) throw AppError.conflict("Draft is not pending", "DRAFT_NOT_PENDING");
    await this.repository.recordUsage({
      userId: user.id,
      threadId: draft.threadId,
      eventType: "draft_discarded",
      entityType: draft.kind,
    });
    return draft;
  }

  async getUsage(user: { id: string; email?: string | null }) {
    await this.assertEnabled(user);
    return {
      quota: await this.quota(user.id),
      totals: await this.repository.usageTotals(user.id),
    };
  }

  async listStarters(
    user: { id: string; email?: string | null },
    input: Parameters<AssistantRepository["listStarters"]>[0],
  ) {
    await this.assertEnabled(user);
    return this.repository.listStarters(input);
  }

  async copyStarter(
    user: { id: string; email?: string | null },
    starterId: string,
    organizationId?: string,
  ) {
    await this.assertEnabled(user);
    if (organizationId && !(await this.authorization.isOrgMember(user.id, organizationId))) {
      throw AppError.forbidden("You cannot create resources in this organization");
    }
    const source = await this.repository.resolveStarter(starterId);
    if (!source) throw AppError.notFound("Starter not found");
    const suffix = starterId.slice(0, 4);
    let created: AssistantCreatedEntity;
    if (source.type === "experiment") {
      const value = source.value;
      const result = await this.createExperiment.execute(
        {
          name: `Copy of ${value.name} ${suffix}`,
          description: value.description ?? undefined,
          status: value.status,
          visibility: "private",
          members: [],
          locations: [],
        },
        user.id,
        organizationId ?? null,
      );
      if (result.isFailure()) throw result.error;
      created = this.created("experiment", result.value.id, result.value.name);
    } else if (source.type === "protocol") {
      const value = source.value;
      const result = await this.createProtocol.execute(
        {
          name: `Copy of ${value.name} ${suffix}`,
          description: value.description ?? undefined,
          code: value.code,
          family: value.family,
          forkedFrom: value.id,
          visibility: "private",
        } as CreateProtocolDto,
        user.id,
        organizationId ?? null,
      );
      if (result.isFailure()) throw result.error;
      created = this.created("protocol", result.value.id, result.value.name);
    } else if (source.type === "workbook") {
      const value = source.value;
      const result = await this.createWorkbook.execute(
        {
          name: `Copy of ${value.name} ${suffix}`,
          description: value.description ?? undefined,
          cells: value.cells,
          metadata: value.metadata,
          forkedFrom: value.id,
          visibility: "private",
        } as CreateWorkbookDto,
        user.id,
        organizationId ?? null,
      );
      if (result.isFailure()) throw result.error;
      created = this.created("workbook", result.value.id, result.value.name);
    } else {
      const value = source.value;
      const result = await this.createMacro.execute(
        {
          name: `Copy of ${value.name} ${suffix}`,
          description: value.description ?? undefined,
          code: value.code,
          language: value.language,
          forkedFrom: value.id,
          visibility: "private",
        },
        user.id,
        organizationId ?? null,
      );
      if (result.isFailure()) throw result.error;
      created = this.created("macro", result.value.id, result.value.name);
    }
    await this.repository.recordStarterCopy({
      sourceType: source.type,
      sourceId: starterId,
      createdType: source.type,
      createdId: created.id,
      userId: user.id,
      organizationId,
    });
    await this.repository.recordUsage({
      userId: user.id,
      organizationId,
      eventType: "starter_copy",
      entityType: source.type,
      metadata: { sourceId: starterId },
    });
    return { ...created, derivedFrom: { type: source.type, id: starterId } };
  }

  async metrics(user: { id: string; email?: string | null }, from?: string, to?: string) {
    this.assertOperator(user.id);
    const [totals, daily, dailyTokenLimit] = await Promise.all([
      this.repository.usageTotals(
        undefined,
        from ? new Date(from) : undefined,
        to ? new Date(to) : undefined,
      ),
      this.repository.dailyMetrics(
        from ? new Date(from) : undefined,
        to ? new Date(to) : undefined,
      ),
      this.repository.dailyTokenLimit(this.defaultDailyLimit()),
    ]);
    return { totals, daily, dailyTokenLimit };
  }

  async setDailyBudget(user: { id: string }, dailyTokens: number) {
    this.assertOperator(user.id);
    await this.repository.setDailyTokenLimit(user.id, dailyTokens);
    return { dailyTokenLimit: dailyTokens };
  }

  async listCollections(user: { id: string }) {
    this.assertOperator(user.id);
    return this.repository.listCollections();
  }

  async upsertCollection(
    user: { id: string },
    input: { id?: string; name: string; description?: string | null; sortOrder?: number },
  ) {
    this.assertOperator(user.id);
    return this.repository.upsertCollection({ ...input, userId: user.id });
  }

  async setCollectionItems(user: { id: string }, collectionId: string, starterIds: string[]) {
    this.assertOperator(user.id);
    const items = await this.repository.resolveStarterTypes(starterIds);
    if (items.length !== starterIds.length) {
      throw AppError.badRequest("Every collection item must be a public starter");
    }
    const collection = await this.repository.setCollectionItems(collectionId, items);
    if (!collection) throw AppError.notFound("Starter collection not found");
    return collection;
  }

  private async assertEnabled(user: { id: string; email?: string | null }): Promise<void> {
    const explicitlyEnabled = this.config.get<boolean>("assistant.enabled") === true;
    if (explicitlyEnabled) return;
    const flagged = await this.analytics.isFeatureFlagEnabled(
      FEATURE_FLAGS.ASSISTANT,
      user.email ?? user.id,
    );
    if (!flagged) {
      throw AppError.forbidden("The research assistant is disabled", "ASSISTANT_DISABLED");
    }
  }

  private assertOperator(userId: string): void {
    const ids = this.config.get<string[]>("assistant.operatorUserIds") ?? [];
    if (!ids.includes(userId)) {
      throw AppError.forbidden("Assistant operator access is required", "OPERATOR_REQUIRED");
    }
  }

  private async assertContextReadable(userId: string, context?: AssistantContext): Promise<void> {
    const entity = context?.entity;
    if (!entity || entity.type === "dashboard") return;
    const decision = await this.authorization.can(userId, {
      resourceType: entity.type,
      resourceId: entity.id,
      action: "read",
    });
    if (!decision.allow) throw AppError.forbidden("The current page is unavailable");
  }

  private async assertSourceReadable(
    userId: string,
    source: AssistantSource | null,
  ): Promise<void> {
    if (!source?.entityType || !source.entityId || source.entityType === "dashboard") return;
    const decision = await this.authorization.can(userId, {
      resourceType: source.entityType,
      resourceId: source.entityId,
      action: "read",
    });
    if (!decision.allow) {
      throw AppError.forbidden("The draft source is no longer available", "DRAFT_FORBIDDEN");
    }
  }

  private async assertPayloadReferencesReadable(
    userId: string,
    payload: ReturnType<typeof zAssistantDraftPayload.parse>,
  ): Promise<void> {
    if (payload.kind === "visualization") {
      const decision = await this.authorization.can(userId, {
        resourceType: "experiment",
        resourceId: payload.value.experimentId,
        action: "manage",
      });
      if (!decision.allow) {
        throw AppError.forbidden(
          "You can no longer save visualizations to this experiment",
          "DRAFT_FORBIDDEN",
        );
      }
      return;
    }
    for (const reference of getAssistantDraftReadReferences(payload)) {
      const decision = await this.authorization.can(userId, {
        resourceType: reference.type,
        resourceId: reference.id,
        action: "read",
      });
      if (!decision.allow) {
        throw AppError.forbidden(
          "A resource referenced by this draft is no longer available",
          "DRAFT_FORBIDDEN",
        );
      }
    }
  }

  private async assertDraftCreationAllowed(
    userId: string,
    source: AssistantSource | null,
    payload: ReturnType<typeof zAssistantDraftPayload.parse>,
  ): Promise<string | undefined> {
    await this.assertSourceReadable(userId, source);
    await this.assertPayloadReferencesReadable(userId, payload);
    const organizationId =
      "organizationId" in payload.value ? payload.value.organizationId : undefined;
    if (organizationId && !(await this.authorization.isOrgMember(userId, organizationId))) {
      throw AppError.forbidden(
        "You cannot create resources in this organization",
        "DRAFT_FORBIDDEN",
      );
    }
    return organizationId;
  }

  private async attachCreatedExperimentWorkbook(
    userId: string,
    payload: ReturnType<typeof zAssistantDraftPayload.parse>,
    created: AssistantCreatedEntity,
  ): Promise<void> {
    if (payload.kind !== "experiment" || !payload.value.workbookId) return;
    if (created.type !== "experiment")
      throw AppError.internal("Draft creation kind does not match its payload");
    const access = await this.authorization.can(userId, {
      resourceType: "experiment",
      resourceId: created.id,
      action: "manage",
    });
    if (!access.allow)
      throw AppError.forbidden(
        "You can no longer attach this experiment's workbook",
        "DRAFT_FORBIDDEN",
      );
    const attached = await this.attachWorkbook.execute(
      created.id,
      payload.value.workbookId,
      userId,
    );
    if (attached.isFailure()) throw attached.error;
  }

  private async createFromPayload(
    userId: string,
    payload: ReturnType<typeof zAssistantDraftPayload.parse>,
  ): Promise<AssistantCreatedEntity> {
    if (payload.kind === "visualization") {
      const { experimentId, ...value } = payload.value;
      const result = await this.createVisualization.execute(experimentId, value, userId);
      if (result.isFailure()) throw result.error;
      return {
        type: "visualization",
        id: result.value.id,
        name: result.value.name,
        url: `/platform/experiments/${experimentId}/analysis/visualizations/${result.value.id}`,
      };
    }
    if (payload.kind === "experiment") {
      const { organizationId, workbookId: _workbookId, ...value } = payload.value;
      const result = await this.createExperiment.execute(
        {
          ...value,
          embargoUntil: value.embargoUntil ? new Date(value.embargoUntil) : undefined,
        },
        userId,
        organizationId ?? null,
      );
      if (result.isFailure()) throw result.error;
      return this.created("experiment", result.value.id, result.value.name);
    }
    if (payload.kind === "protocol") {
      const { organizationId, ...value } = payload.value;
      const result = await this.createProtocol.execute(value, userId, organizationId ?? null);
      if (result.isFailure()) throw result.error;
      return this.created("protocol", result.value.id, result.value.name);
    }
    if (payload.kind === "workbook") {
      const { organizationId, ...value } = payload.value;
      const result = await this.createWorkbook.execute(
        value as CreateWorkbookDto,
        userId,
        organizationId ?? null,
      );
      if (result.isFailure()) throw result.error;
      return this.created("workbook", result.value.id, result.value.name);
    }
    const { organizationId, codeEncoding, ...value } = payload.value;
    const result = await this.createMacro.execute(
      {
        ...value,
        code:
          codeEncoding === "utf8" ? Buffer.from(value.code, "utf8").toString("base64") : value.code,
      },
      userId,
      organizationId ?? null,
    );
    if (result.isFailure()) throw result.error;
    return this.created("macro", result.value.id, result.value.name);
  }

  private privateByDefault(payload: ReturnType<typeof zAssistantDraftPayload.parse>) {
    if (payload.kind !== "visualization") payload.value.visibility ??= "private";
    return payload;
  }

  private created(
    type: AssistantCreatedEntity["type"],
    id: string,
    name: string,
  ): AssistantCreatedEntity {
    const plural = type === "macro" ? "macros" : `${type}s`;
    return { type, id, name, url: `/platform/${plural}/${id}` };
  }

  private async quota(userId: string) {
    return this.repository.quota(userId, this.defaultDailyLimit());
  }

  private defaultDailyLimit(): number {
    return this.config.get<number>("assistant.dailyTokenLimit") ?? 100_000;
  }

  private maxTotalTokens(): number {
    return Math.min(this.config.get<number>("assistant.maxTotalTokens") ?? 100_000, 100_000);
  }

  private usageFromError(error: unknown): {
    inputTokens: number;
    outputTokens: number;
    usageComplete: boolean;
  } {
    if (!(error instanceof AppError) || typeof error.details !== "object" || !error.details) {
      return { inputTokens: 0, outputTokens: 0, usageComplete: false };
    }
    const details = error.details as Record<string, unknown>;
    const usage =
      typeof details.usage === "object" && details.usage
        ? (details.usage as Record<string, unknown>)
        : {};
    const inputTokens = usage.inputTokens;
    const outputTokens = usage.outputTokens;
    return {
      inputTokens:
        typeof inputTokens === "number" && Number.isInteger(inputTokens) && inputTokens >= 0
          ? inputTokens
          : 0,
      outputTokens:
        typeof outputTokens === "number" && Number.isInteger(outputTokens) && outputTokens >= 0
          ? outputTokens
          : 0,
      usageComplete: details.usageComplete === true,
    };
  }

  private title(message: string): string {
    const compact = message.replace(/\s+/g, " ").trim();
    return compact.length <= 72 ? compact : `${compact.slice(0, 69)}...`;
  }

  private contextPrefix(context: AssistantContext): string {
    if (!context.entity) return `[Current route: ${context.route}]\n`;
    return `[Current page: ${context.entity.type} ${context.entity.id}${context.entity.title ? `, ${context.entity.title}` : ""}]\n`;
  }

  private textDeltas(content: string): string[] {
    const deltas = content.match(/.{1,120}(?:\s+|$)/gs);
    return deltas?.map((delta) => delta) ?? [content];
  }
}
