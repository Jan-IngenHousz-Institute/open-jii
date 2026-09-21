import { Inject, Injectable } from "@nestjs/common";

import type {
  AssistantContext,
  AssistantDraft,
  AssistantDraftPayload,
  AssistantMessage,
  AssistantQuota,
  AssistantSource,
  AssistantStarter,
  AssistantStarterCollection,
  AssistantThread,
  AssistantToolCall,
  AssistantUsageTotals,
} from "@repo/api/domains/assistant/assistant.schema";
import {
  and,
  assistantDrafts,
  assistantMessages,
  assistantSettings,
  assistantStarterCollectionItems,
  assistantStarterCollections,
  assistantStarterCopies,
  assistantThreads,
  assistantUsageEvents,
  count,
  desc,
  eq,
  experiments,
  gte,
  inArray,
  lt,
  macros,
  organizations,
  protocols,
  sql,
  sum,
  workbooks,
} from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { AppError } from "../../common/utils/fp-utils";

type StarterType = "experiment" | "protocol" | "workbook" | "macro";
interface StarterCursor {
  sort: "reuse" | "updated";
  reuseCount: number;
  updatedAt: string;
  type: StarterType;
  id: string;
}

const STARTER_SCAN_LIMIT = 500;
const STARTER_RELATED_SCAN_LIMIT = 2_000;

function iso(value: Date): string {
  return value.toISOString();
}

function nextReset(): string {
  const date = new Date();
  date.setUTCHours(24, 0, 0, 0);
  return date.toISOString();
}

@Injectable()
export class AssistantRepository {
  constructor(@Inject("DATABASE") private readonly db: DatabaseInstance) {}

  async createThread(
    userId: string,
    title: string,
    context: AssistantContext | null,
  ): Promise<AssistantThread> {
    const rows = await this.db
      .insert(assistantThreads)
      .values({ userId, title, context })
      .returning();
    const row = rows.at(0);
    if (!row) throw new Error("Assistant thread was not created");
    return this.thread(row);
  }

  async getThread(userId: string, threadId: string): Promise<AssistantThread | null> {
    const rows = await this.db
      .select()
      .from(assistantThreads)
      .where(and(eq(assistantThreads.id, threadId), eq(assistantThreads.userId, userId)))
      .limit(1);
    const row = rows.at(0);
    return row ? this.thread(row) : null;
  }

  async listThreads(
    userId: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<{ items: AssistantThread[]; nextCursor: string | null }> {
    const rows = await this.db
      .select()
      .from(assistantThreads)
      .where(
        cursor
          ? and(
              eq(assistantThreads.userId, userId),
              lt(assistantThreads.updatedAt, new Date(cursor)),
            )
          : eq(assistantThreads.userId, userId),
      )
      .orderBy(desc(assistantThreads.updatedAt))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return {
      items: page.map((row) => this.thread(row)),
      nextCursor: hasMore && page.length > 0 ? iso(page[page.length - 1].updatedAt) : null,
    };
  }

  async touchThread(threadId: string, context?: AssistantContext): Promise<void> {
    await this.db
      .update(assistantThreads)
      .set({ ...(context ? { context } : {}), updatedAt: new Date() })
      .where(eq(assistantThreads.id, threadId));
  }

  async createMessage(input: {
    threadId: string;
    role: "user" | "assistant";
    content: string;
    sources?: AssistantSource[];
    toolCalls?: AssistantToolCall[];
    inputTokens?: number;
    outputTokens?: number;
    clientRequestId?: string;
  }): Promise<AssistantMessage> {
    const rows = await this.db
      .insert(assistantMessages)
      .values({
        threadId: input.threadId,
        role: input.role,
        content: input.content,
        sources: input.sources ?? [],
        toolCalls: input.toolCalls ?? [],
        inputTokens: input.inputTokens ?? 0,
        outputTokens: input.outputTokens ?? 0,
        clientRequestId: input.clientRequestId,
      })
      .returning();
    const row = rows.at(0);
    if (!row) throw new Error("Assistant message was not created");
    return this.message(row, []);
  }

  async listMessages(threadId: string): Promise<AssistantMessage[]> {
    const [messages, draftRows] = await Promise.all([
      this.db
        .select()
        .from(assistantMessages)
        .where(eq(assistantMessages.threadId, threadId))
        .orderBy(assistantMessages.createdAt),
      this.db
        .select({ id: assistantDrafts.id, messageId: assistantDrafts.messageId })
        .from(assistantDrafts)
        .where(eq(assistantDrafts.threadId, threadId)),
    ]);
    const draftIds = new Map<string, string[]>();
    for (const draft of draftRows) {
      if (!draft.messageId) continue;
      draftIds.set(draft.messageId, [...(draftIds.get(draft.messageId) ?? []), draft.id]);
    }
    return messages.map((row) => this.message(row, draftIds.get(row.id) ?? []));
  }

  async rateMessage(
    userId: string,
    threadId: string,
    messageId: string,
    rating: "up" | "down" | null,
  ): Promise<AssistantMessage | null> {
    const thread = await this.getThread(userId, threadId);
    if (!thread) return null;
    const rows = await this.db
      .update(assistantMessages)
      .set({ rating })
      .where(and(eq(assistantMessages.id, messageId), eq(assistantMessages.threadId, threadId)))
      .returning();
    const row = rows.at(0);
    if (!row) return null;
    const drafts = await this.db
      .select({ id: assistantDrafts.id })
      .from(assistantDrafts)
      .where(eq(assistantDrafts.messageId, messageId));
    return this.message(
      row,
      drafts.map((draft) => draft.id),
    );
  }

  async createDraft(input: {
    threadId: string;
    messageId?: string;
    userId: string;
    payload: AssistantDraftPayload;
    source?: AssistantSource;
  }): Promise<AssistantDraft> {
    const rows = await this.db
      .insert(assistantDrafts)
      .values({
        threadId: input.threadId,
        messageId: input.messageId,
        userId: input.userId,
        kind: input.payload.kind,
        payload: input.payload,
        source: input.source,
      })
      .returning();
    const row = rows.at(0);
    if (!row) throw new Error("Assistant draft was not created");
    return this.draft(row);
  }

  async listDrafts(userId: string, threadId: string): Promise<AssistantDraft[]> {
    const rows = await this.db
      .select()
      .from(assistantDrafts)
      .where(and(eq(assistantDrafts.userId, userId), eq(assistantDrafts.threadId, threadId)))
      .orderBy(assistantDrafts.createdAt);
    return rows.map((row) => this.draft(row));
  }

  async getDraft(userId: string, draftId: string): Promise<AssistantDraft | null> {
    const rows = await this.db
      .select()
      .from(assistantDrafts)
      .where(and(eq(assistantDrafts.id, draftId), eq(assistantDrafts.userId, userId)))
      .limit(1);
    const row = rows.at(0);
    return row ? this.draft(row) : null;
  }

  async updateDraft(
    userId: string,
    draftId: string,
    payload: AssistantDraftPayload,
  ): Promise<AssistantDraft | null> {
    const rows = await this.db
      .update(assistantDrafts)
      .set({ payload, kind: payload.kind, updatedAt: new Date() })
      .where(
        and(
          eq(assistantDrafts.id, draftId),
          eq(assistantDrafts.userId, userId),
          eq(assistantDrafts.status, "pending"),
        ),
      )
      .returning();
    const row = rows.at(0);
    return row ? this.draft(row) : null;
  }

  async finishDraft(
    userId: string,
    draftId: string,
    status: "confirmed" | "discarded",
    createdEntity?: AssistantDraft["createdEntity"],
  ): Promise<AssistantDraft | null> {
    const rows = await this.db
      .update(assistantDrafts)
      .set({ status, createdEntity, updatedAt: new Date() })
      .where(
        and(
          eq(assistantDrafts.id, draftId),
          eq(assistantDrafts.userId, userId),
          status === "confirmed"
            ? eq(assistantDrafts.status, "confirming")
            : eq(assistantDrafts.status, "pending"),
        ),
      )
      .returning();
    const row = rows.at(0);
    return row ? this.draft(row) : null;
  }

  async claimDraft(userId: string, draftId: string): Promise<AssistantDraft | null> {
    const rows = await this.db
      .update(assistantDrafts)
      .set({ status: "confirming", updatedAt: new Date() })
      .where(
        and(
          eq(assistantDrafts.id, draftId),
          eq(assistantDrafts.userId, userId),
          eq(assistantDrafts.status, "pending"),
        ),
      )
      .returning();
    const row = rows.at(0);
    return row ? this.draft(row) : null;
  }

  async recordDraftCreated(
    userId: string,
    draftId: string,
    createdEntity: NonNullable<AssistantDraft["createdEntity"]>,
  ): Promise<AssistantDraft | null> {
    const rows = await this.db
      .update(assistantDrafts)
      .set({ createdEntity, updatedAt: new Date() })
      .where(
        and(
          eq(assistantDrafts.id, draftId),
          eq(assistantDrafts.userId, userId),
          eq(assistantDrafts.status, "confirming"),
        ),
      )
      .returning();
    const row = rows.at(0);
    return row ? this.draft(row) : null;
  }

  async releaseDraftClaim(userId: string, draftId: string): Promise<void> {
    await this.db
      .update(assistantDrafts)
      .set({ status: "pending", updatedAt: new Date() })
      .where(
        and(
          eq(assistantDrafts.id, draftId),
          eq(assistantDrafts.userId, userId),
          eq(assistantDrafts.status, "confirming"),
        ),
      );
  }

  async dailyTokens(userId: string): Promise<number> {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const [row] = await this.db
      .select({
        input: sum(assistantUsageEvents.inputTokens),
        output: sum(assistantUsageEvents.outputTokens),
      })
      .from(assistantUsageEvents)
      .where(
        and(eq(assistantUsageEvents.userId, userId), gte(assistantUsageEvents.createdAt, start)),
      );
    return Number(row.input ?? 0) + Number(row.output ?? 0);
  }

  async quota(userId: string, fallbackLimit: number): Promise<AssistantQuota> {
    const limit = await this.dailyTokenLimit(fallbackLimit);
    const used = await this.dailyTokens(userId);
    return {
      dailyTokenLimit: limit,
      tokensUsed: used,
      tokensRemaining: Math.max(0, limit - used),
      resetsAt: nextReset(),
      exhausted: used >= limit,
    };
  }

  async reserveTurnBudget(
    userId: string,
    fallbackLimit: number,
    maxTurnTokens: number,
  ): Promise<{ reservationId: string; quota: AssistantQuota; reservedTokens: number } | null> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`);
      const start = new Date();
      start.setUTCHours(0, 0, 0, 0);
      const [settingRows, usageRows] = await Promise.all([
        tx
          .select({ value: assistantSettings.value })
          .from(assistantSettings)
          .where(eq(assistantSettings.key, "dailyTokenLimit"))
          .limit(1),
        tx
          .select({
            input: sum(assistantUsageEvents.inputTokens),
            output: sum(assistantUsageEvents.outputTokens),
          })
          .from(assistantUsageEvents)
          .where(
            and(
              eq(assistantUsageEvents.userId, userId),
              gte(assistantUsageEvents.createdAt, start),
            ),
          ),
      ]);
      const setting = settingRows.at(0);
      const usage = usageRows[0];
      const limit =
        typeof setting?.value === "number" && setting.value > 0 ? setting.value : fallbackLimit;
      const used = Number(usage.input ?? 0) + Number(usage.output ?? 0);
      const remaining = Math.max(0, limit - used);
      if (remaining === 0) return null;
      const reservedTokens = Math.min(remaining, maxTurnTokens);
      const reservationRows = await tx
        .insert(assistantUsageEvents)
        .values({
          userId,
          eventType: "turn_reservation",
          outputTokens: reservedTokens,
          metadata: { usageComplete: false },
        })
        .returning({ id: assistantUsageEvents.id });
      const reservation = reservationRows.at(0);
      if (!reservation) return null;
      return {
        reservationId: reservation.id,
        reservedTokens,
        quota: {
          dailyTokenLimit: limit,
          tokensUsed: used,
          tokensRemaining: remaining,
          resetsAt: nextReset(),
          exhausted: false,
        },
      };
    });
  }

  async reconcileTurnBudget(input: {
    reservationId: string;
    userId: string;
    threadId?: string;
    entityType?: string;
    inputTokens: number;
    outputTokens: number;
    usageComplete: boolean;
    status: "completed" | "failed";
  }): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.userId}, 0))`);
      const reservationRows = await tx
        .select({
          inputTokens: assistantUsageEvents.inputTokens,
          outputTokens: assistantUsageEvents.outputTokens,
        })
        .from(assistantUsageEvents)
        .where(
          and(
            eq(assistantUsageEvents.id, input.reservationId),
            eq(assistantUsageEvents.userId, input.userId),
            eq(assistantUsageEvents.eventType, "turn_reservation"),
          ),
        )
        .limit(1);
      const reservation = reservationRows.at(0);
      if (!reservation) return;
      const reserved = reservation.inputTokens + reservation.outputTokens;
      const accounted = input.inputTokens + input.outputTokens;
      const inputTokens = input.usageComplete
        ? input.inputTokens
        : Math.min(input.inputTokens, reserved);
      const outputTokens = input.usageComplete
        ? input.outputTokens
        : Math.max(input.outputTokens, reserved - inputTokens);
      await tx
        .update(assistantUsageEvents)
        .set({
          threadId: input.threadId,
          eventType: "turn",
          entityType: input.entityType,
          inputTokens,
          outputTokens,
          metadata: {
            status: input.status,
            usageComplete: input.usageComplete,
            ...(input.usageComplete
              ? {}
              : {
                  lowerBoundInputTokens: input.inputTokens,
                  lowerBoundOutputTokens: input.outputTokens,
                  reservedTokens: Math.max(reserved, accounted),
                }),
          },
        })
        .where(eq(assistantUsageEvents.id, input.reservationId));
    });
  }

  async recordUsage(input: {
    userId: string;
    threadId?: string;
    organizationId?: string;
    eventType: string;
    entityType?: string;
    inputTokens?: number;
    outputTokens?: number;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(assistantUsageEvents).values({
      userId: input.userId,
      threadId: input.threadId,
      organizationId: input.organizationId,
      eventType: input.eventType,
      entityType: input.entityType,
      inputTokens: input.inputTokens ?? 0,
      outputTokens: input.outputTokens ?? 0,
      metadata: input.metadata ?? {},
    });
  }

  async usageTotals(userId?: string, from?: Date, to?: Date): Promise<AssistantUsageTotals> {
    const conditions = [
      ...(userId ? [eq(assistantUsageEvents.userId, userId)] : []),
      ...(from ? [gte(assistantUsageEvents.createdAt, from)] : []),
      ...(to ? [lt(assistantUsageEvents.createdAt, to)] : []),
    ];
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [row] = await this.db
      .select({
        turns: count(sql`CASE WHEN ${assistantUsageEvents.eventType} = 'turn' THEN 1 END`),
        inputTokens: sum(assistantUsageEvents.inputTokens),
        outputTokens: sum(assistantUsageEvents.outputTokens),
        toolCalls: count(sql`CASE WHEN ${assistantUsageEvents.eventType} = 'tool_call' THEN 1 END`),
        approvals: count(
          sql`CASE WHEN ${assistantUsageEvents.eventType} = 'draft_confirmed' THEN 1 END`,
        ),
        discards: count(
          sql`CASE WHEN ${assistantUsageEvents.eventType} = 'draft_discarded' THEN 1 END`,
        ),
        ratingsUp: count(sql`CASE WHEN ${assistantUsageEvents.eventType} = 'rating_up' THEN 1 END`),
        ratingsDown: count(
          sql`CASE WHEN ${assistantUsageEvents.eventType} = 'rating_down' THEN 1 END`,
        ),
        starterCopies: count(
          sql`CASE WHEN ${assistantUsageEvents.eventType} = 'starter_copy' THEN 1 END`,
        ),
      })
      .from(assistantUsageEvents)
      .where(where);
    return {
      turns: Number(row.turns),
      inputTokens: Number(row.inputTokens ?? 0),
      outputTokens: Number(row.outputTokens ?? 0),
      toolCalls: Number(row.toolCalls),
      approvals: Number(row.approvals),
      discards: Number(row.discards),
      ratingsUp: Number(row.ratingsUp),
      ratingsDown: Number(row.ratingsDown),
      starterCopies: Number(row.starterCopies),
    };
  }

  async dailyMetrics(from?: Date, to?: Date) {
    const conditions = [
      ...(from ? [gte(assistantUsageEvents.createdAt, from)] : []),
      ...(to ? [lt(assistantUsageEvents.createdAt, to)] : []),
    ];
    const rows = await this.db
      .select({
        date: sql<string>`to_char(date_trunc('day', ${assistantUsageEvents.createdAt}), 'YYYY-MM-DD')`,
        eventType: assistantUsageEvents.eventType,
        count: count(),
        inputTokens: sum(assistantUsageEvents.inputTokens),
        outputTokens: sum(assistantUsageEvents.outputTokens),
      })
      .from(assistantUsageEvents)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(
        sql`date_trunc('day', ${assistantUsageEvents.createdAt})`,
        assistantUsageEvents.eventType,
      )
      .orderBy(sql`date_trunc('day', ${assistantUsageEvents.createdAt})`);
    const byDate = new Map<string, AssistantUsageTotals>();
    for (const row of rows) {
      const totals = byDate.get(row.date) ?? this.emptyTotals();
      totals.inputTokens += Number(row.inputTokens ?? 0);
      totals.outputTokens += Number(row.outputTokens ?? 0);
      const amount = Number(row.count);
      if (row.eventType === "turn") totals.turns += amount;
      if (row.eventType === "tool_call") totals.toolCalls += amount;
      if (row.eventType === "draft_confirmed") totals.approvals += amount;
      if (row.eventType === "draft_discarded") totals.discards += amount;
      if (row.eventType === "rating_up") totals.ratingsUp += amount;
      if (row.eventType === "rating_down") totals.ratingsDown += amount;
      if (row.eventType === "starter_copy") totals.starterCopies += amount;
      byDate.set(row.date, totals);
    }
    return [...byDate.entries()].map(([date, totals]) => ({ date, totals }));
  }

  async dailyTokenLimit(fallback: number): Promise<number> {
    const rows = await this.db
      .select({ value: assistantSettings.value })
      .from(assistantSettings)
      .where(eq(assistantSettings.key, "dailyTokenLimit"))
      .limit(1);
    const row = rows.at(0);
    const configured = row?.value;
    return typeof configured === "number" && configured > 0 ? configured : fallback;
  }

  async setDailyTokenLimit(userId: string, dailyTokens: number): Promise<void> {
    await this.db
      .insert(assistantSettings)
      .values({ key: "dailyTokenLimit", value: dailyTokens, updatedBy: userId })
      .onConflictDoUpdate({
        target: assistantSettings.key,
        set: { value: dailyTokens, updatedBy: userId, updatedAt: new Date() },
      });
  }

  async listStarters(input: {
    query?: string;
    type?: StarterType;
    sort: "reuse" | "updated";
    cursor?: string;
    limit: number;
  }): Promise<{ items: AssistantStarter[]; nextCursor: string | null }> {
    const [experimentRows, protocolRows, workbookRows, macroRows, collectionRows, copyRows] =
      await Promise.all([
        !input.type || input.type === "experiment"
          ? this.db
              .select({
                id: experiments.id,
                name: experiments.name,
                description: experiments.description,
                updatedAt: experiments.updatedAt,
                ownerName: organizations.name,
              })
              .from(experiments)
              .leftJoin(organizations, eq(organizations.id, experiments.organizationId))
              .where(eq(experiments.visibility, "public"))
              .limit(STARTER_SCAN_LIMIT)
          : [],
        !input.type || input.type === "protocol"
          ? this.db
              .select({
                id: protocols.id,
                name: protocols.name,
                description: protocols.description,
                updatedAt: protocols.updatedAt,
                ownerName: organizations.name,
              })
              .from(protocols)
              .leftJoin(organizations, eq(organizations.id, protocols.organizationId))
              .where(eq(protocols.visibility, "public"))
              .limit(STARTER_SCAN_LIMIT)
          : [],
        !input.type || input.type === "workbook"
          ? this.db
              .select({
                id: workbooks.id,
                name: workbooks.name,
                description: workbooks.description,
                updatedAt: workbooks.updatedAt,
                ownerName: organizations.name,
              })
              .from(workbooks)
              .leftJoin(organizations, eq(organizations.id, workbooks.organizationId))
              .where(eq(workbooks.visibility, "public"))
              .limit(STARTER_SCAN_LIMIT)
          : [],
        !input.type || input.type === "macro"
          ? this.db
              .select({
                id: macros.id,
                name: macros.name,
                description: macros.description,
                updatedAt: macros.updatedAt,
                ownerName: organizations.name,
              })
              .from(macros)
              .leftJoin(organizations, eq(organizations.id, macros.organizationId))
              .where(eq(macros.visibility, "public"))
              .limit(STARTER_SCAN_LIMIT)
          : [],
        this.db
          .select({
            resourceType: assistantStarterCollectionItems.resourceType,
            resourceId: assistantStarterCollectionItems.resourceId,
            collectionName: assistantStarterCollections.name,
          })
          .from(assistantStarterCollectionItems)
          .innerJoin(
            assistantStarterCollections,
            eq(assistantStarterCollections.id, assistantStarterCollectionItems.collectionId),
          )
          .limit(STARTER_RELATED_SCAN_LIMIT),
        this.db
          .select({
            sourceType: assistantStarterCopies.sourceType,
            sourceId: assistantStarterCopies.sourceId,
            reuseCount: count(),
          })
          .from(assistantStarterCopies)
          .groupBy(assistantStarterCopies.sourceType, assistantStarterCopies.sourceId)
          .limit(STARTER_RELATED_SCAN_LIMIT),
      ]);

    const collections = new Map<string, string[]>();
    for (const row of collectionRows) {
      const key = `${row.resourceType}:${row.resourceId}`;
      collections.set(key, [...(collections.get(key) ?? []), row.collectionName]);
    }
    const reuse = new Map(
      copyRows.map((row) => [`${row.sourceType}:${row.sourceId}`, Number(row.reuseCount)]),
    );
    const make = (
      type: StarterType,
      rows: {
        id: string;
        name: string;
        description: string | null;
        updatedAt: Date;
        ownerName: string | null;
      }[],
    ) =>
      rows.map((row): AssistantStarter => {
        const key = `${type}:${row.id}`;
        const collectionNames = collections.get(key) ?? [];
        return {
          id: row.id,
          type,
          name: row.name,
          description: row.description,
          ownerName: row.ownerName,
          curated: collectionNames.length > 0,
          collectionNames,
          reuseCount: reuse.get(key) ?? 0,
          updatedAt: iso(row.updatedAt),
          url: this.entityUrl(type, row.id),
        };
      });
    let items = [
      ...make("experiment", experimentRows),
      ...make("protocol", protocolRows),
      ...make("workbook", workbookRows),
      ...make("macro", macroRows),
    ];
    if (input.query) {
      const query = input.query.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(query) ||
          (item.description?.toLowerCase().includes(query) ?? false),
      );
    }
    items.sort((a, b) => this.compareStarters(a, b, input.sort));
    if (input.cursor) {
      const cursor = this.decodeStarterCursor(input.cursor, input.sort);
      items = items.filter((item) => this.compareStarters(item, cursor, input.sort) > 0);
    }
    const page = items.slice(0, input.limit);
    return {
      items: page,
      nextCursor:
        items.length > input.limit && page.length > 0
          ? this.encodeStarterCursor(page[page.length - 1], input.sort)
          : null,
    };
  }

  async recordStarterCopy(input: {
    sourceType: StarterType;
    sourceId: string;
    createdType: StarterType;
    createdId: string;
    userId: string;
    organizationId?: string;
  }): Promise<void> {
    await this.db.insert(assistantStarterCopies).values(input);
  }

  async listCollections(): Promise<AssistantStarterCollection[]> {
    const [collections, items] = await Promise.all([
      this.db
        .select()
        .from(assistantStarterCollections)
        .orderBy(assistantStarterCollections.sortOrder, assistantStarterCollections.name),
      this.db
        .select()
        .from(assistantStarterCollectionItems)
        .orderBy(assistantStarterCollectionItems.position),
    ]);
    return collections.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      sortOrder: row.sortOrder,
      starterIds: items
        .filter((item) => item.collectionId === row.id)
        .map((item) => item.resourceId),
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    }));
  }

  async upsertCollection(input: {
    id?: string;
    name: string;
    description?: string | null;
    sortOrder?: number;
    userId: string;
  }): Promise<AssistantStarterCollection> {
    const rows = input.id
      ? await this.db
          .update(assistantStarterCollections)
          .set({
            name: input.name,
            description: input.description,
            ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
            updatedAt: new Date(),
          })
          .where(eq(assistantStarterCollections.id, input.id))
          .returning()
      : await this.db
          .insert(assistantStarterCollections)
          .values({
            name: input.name,
            description: input.description,
            sortOrder: input.sortOrder ?? 0,
            createdBy: input.userId,
          })
          .returning();
    const row = rows.at(0);
    if (!row) throw new Error("Starter collection not found");
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      sortOrder: row.sortOrder,
      starterIds: [],
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }

  async setCollectionItems(
    collectionId: string,
    items: { id: string; type: StarterType }[],
  ): Promise<AssistantStarterCollection | null> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(assistantStarterCollectionItems)
        .where(eq(assistantStarterCollectionItems.collectionId, collectionId));
      if (items.length > 0) {
        await tx.insert(assistantStarterCollectionItems).values(
          items.map((item, position) => ({
            collectionId,
            resourceType: item.type,
            resourceId: item.id,
            position,
          })),
        );
      }
    });
    return (
      (await this.listCollections()).find((collection) => collection.id === collectionId) ?? null
    );
  }

  async resolveStarter(
    starterId: string,
  ): Promise<
    | { type: "experiment"; value: typeof experiments.$inferSelect }
    | { type: "protocol"; value: typeof protocols.$inferSelect }
    | { type: "workbook"; value: typeof workbooks.$inferSelect }
    | { type: "macro"; value: typeof macros.$inferSelect }
    | null
  > {
    const [experiment, protocol, workbook, macro] = await Promise.all([
      this.db.select().from(experiments).where(eq(experiments.id, starterId)).limit(1),
      this.db.select().from(protocols).where(eq(protocols.id, starterId)).limit(1),
      this.db.select().from(workbooks).where(eq(workbooks.id, starterId)).limit(1),
      this.db.select().from(macros).where(eq(macros.id, starterId)).limit(1),
    ]);
    if (experiment[0]?.visibility === "public") return { type: "experiment", value: experiment[0] };
    if (protocol[0]?.visibility === "public") return { type: "protocol", value: protocol[0] };
    if (workbook[0]?.visibility === "public") return { type: "workbook", value: workbook[0] };
    if (macro[0]?.visibility === "public") return { type: "macro", value: macro[0] };
    return null;
  }

  async resolveStarterTypes(ids: string[]): Promise<{ id: string; type: StarterType }[]> {
    if (ids.length === 0) return [];
    const [experimentRows, protocolRows, workbookRows, macroRows] = await Promise.all([
      this.db
        .select({ id: experiments.id })
        .from(experiments)
        .where(and(inArray(experiments.id, ids), eq(experiments.visibility, "public"))),
      this.db
        .select({ id: protocols.id })
        .from(protocols)
        .where(and(inArray(protocols.id, ids), eq(protocols.visibility, "public"))),
      this.db
        .select({ id: workbooks.id })
        .from(workbooks)
        .where(and(inArray(workbooks.id, ids), eq(workbooks.visibility, "public"))),
      this.db
        .select({ id: macros.id })
        .from(macros)
        .where(and(inArray(macros.id, ids), eq(macros.visibility, "public"))),
    ]);
    const found = new Map<string, StarterType>([
      ...experimentRows.map((row) => [row.id, "experiment"] as const),
      ...protocolRows.map((row) => [row.id, "protocol"] as const),
      ...workbookRows.map((row) => [row.id, "workbook"] as const),
      ...macroRows.map((row) => [row.id, "macro"] as const),
    ]);
    return ids.flatMap((id) => {
      const type = found.get(id);
      return type ? [{ id, type }] : [];
    });
  }

  private thread(row: typeof assistantThreads.$inferSelect): AssistantThread {
    return {
      id: row.id,
      title: row.title,
      context: (row.context as AssistantContext | null) ?? null,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }

  private message(
    row: typeof assistantMessages.$inferSelect,
    draftIds: string[],
  ): AssistantMessage {
    return {
      id: row.id,
      threadId: row.threadId,
      role: row.role as "user" | "assistant",
      content: row.content,
      sources: row.sources as AssistantSource[],
      toolCalls: row.toolCalls as AssistantToolCall[],
      draftIds,
      rating: row.rating as "up" | "down" | null,
      createdAt: iso(row.createdAt),
    };
  }

  private draft(row: typeof assistantDrafts.$inferSelect): AssistantDraft {
    return {
      id: row.id,
      threadId: row.threadId,
      messageId: row.messageId,
      kind: row.kind as AssistantDraft["kind"],
      status: row.status as AssistantDraft["status"],
      payload: row.payload as AssistantDraftPayload,
      source: row.source as AssistantSource | null,
      createdEntity: row.createdEntity as AssistantDraft["createdEntity"],
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }

  private emptyTotals(): AssistantUsageTotals {
    return {
      turns: 0,
      inputTokens: 0,
      outputTokens: 0,
      toolCalls: 0,
      approvals: 0,
      discards: 0,
      ratingsUp: 0,
      ratingsDown: 0,
      starterCopies: 0,
    };
  }

  private compareStarters(
    left: Pick<AssistantStarter, "id" | "type" | "reuseCount" | "updatedAt">,
    right: Pick<AssistantStarter, "id" | "type" | "reuseCount" | "updatedAt">,
    sort: "reuse" | "updated",
  ): number {
    if (sort === "reuse" && left.reuseCount !== right.reuseCount) {
      return right.reuseCount - left.reuseCount;
    }
    const updated = right.updatedAt.localeCompare(left.updatedAt);
    if (updated !== 0) return updated;
    const type = left.type.localeCompare(right.type);
    return type !== 0 ? type : left.id.localeCompare(right.id);
  }

  private encodeStarterCursor(
    item: Pick<AssistantStarter, "id" | "type" | "reuseCount" | "updatedAt">,
    sort: "reuse" | "updated",
  ): string {
    return Buffer.from(
      JSON.stringify({
        sort,
        reuseCount: item.reuseCount,
        updatedAt: item.updatedAt,
        type: item.type,
        id: item.id,
      } satisfies StarterCursor),
    ).toString("base64url");
  }

  private decodeStarterCursor(value: string, sort: "reuse" | "updated"): StarterCursor {
    try {
      const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<
        string,
        unknown
      >;
      if (
        cursor.sort !== sort ||
        !Number.isInteger(cursor.reuseCount) ||
        Number(cursor.reuseCount) < 0 ||
        typeof cursor.updatedAt !== "string" ||
        !["experiment", "protocol", "workbook", "macro"].includes(String(cursor.type)) ||
        typeof cursor.id !== "string"
      ) {
        throw new Error("invalid cursor");
      }
      return {
        sort,
        reuseCount: Number(cursor.reuseCount),
        updatedAt: cursor.updatedAt,
        type: cursor.type as StarterType,
        id: cursor.id,
      };
    } catch {
      throw AppError.badRequest("Invalid starter cursor", "INVALID_CURSOR");
    }
  }

  private entityUrl(type: StarterType, id: string): string {
    if (type === "experiment") return `/platform/experiments/${id}`;
    if (type === "protocol") return `/platform/protocols/${id}`;
    if (type === "macro") return `/platform/macros/${id}`;
    return `/platform/workbooks/${id}`;
  }
}
