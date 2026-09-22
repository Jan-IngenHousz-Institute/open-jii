"use client";

import { useAssistant } from "@/components/assistant/assistant-context";
import { AssistantDraftCard } from "@/components/assistant/assistant-draft-card";
import {
  AssistantBubble,
  AssistantMarker,
  AssistantMessage,
  AssistantMessageScroller,
  AssistantMessageScrollerItem,
  AssistantResponse,
} from "@/components/assistant/assistant-message";
import { usePlatformHeaderDetail } from "@/components/navigation/site-header/platform-header-context";
import { getOrpcError, orpc, orpcClient } from "@/lib/orpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpenText,
  Check,
  CircleAlert,
  Clock3,
  ExternalLink,
  History,
  LoaderCircle,
  MessageSquarePlus,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Wrench,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { env } from "~/env";

import type {
  AssistantChatEvent,
  AssistantChatInput,
  AssistantChatResponse,
  AssistantContext,
  AssistantDraft,
  AssistantMessage as AssistantMessageData,
  AssistantSource,
  AssistantToolCall,
} from "@repo/api/domains/assistant/assistant.schema";
import { useTranslation } from "@repo/i18n";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/alert";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import { Progress } from "@repo/ui/components/progress";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { Textarea } from "@repo/ui/components/textarea";
import { cn } from "@repo/ui/lib/utils";

import { resolveAssistantSourceLink } from "./assistant-source-link";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ENTITY_SEGMENTS = {
  experiments: "experiment",
  protocols: "protocol",
  workbooks: "workbook",
  macros: "macro",
  dashboards: "dashboard",
} as const;

function assistantContextFor(
  pathname: string,
  locale: string,
  detail: { label: string } | null,
): AssistantContext {
  const segments = pathname.split("/").filter(Boolean);
  const platform = segments.indexOf("platform");
  const collection = segments[platform + 1] as keyof typeof ENTITY_SEGMENTS | undefined;
  const id = segments[platform + 2];
  const type = collection ? ENTITY_SEGMENTS[collection] : undefined;
  return {
    route: pathname,
    locale,
    ...(type && id && UUID.test(id)
      ? { entity: { type, id, ...(detail?.label ? { title: detail.label } : {}) } }
      : {}),
  };
}

function SourceChip({ source }: { source: AssistantSource }) {
  const content = (
    <>
      <span className="bg-primary/10 text-primary flex size-4 items-center justify-center rounded text-[9px] font-semibold">
        {source.type === "literature"
          ? (source.page ?? "L")
          : source.type.slice(0, 1).toUpperCase()}
      </span>
      <span className="max-w-44 truncate">{source.title}</span>
      {source.year && <span className="text-muted-foreground">{source.year}</span>}
      {source.url && <ExternalLink className="size-3" />}
    </>
  );
  const classes =
    "border-border bg-background text-foreground hover:bg-muted inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-[11px] transition-colors";
  return source.url ? (
    <a
      href={
        source.type === "docs"
          ? resolveAssistantSourceLink(
              source.url,
              env.NEXT_PUBLIC_DOCS_URL,
              env.NEXT_PUBLIC_BASE_URL,
            )
          : source.url
      }
      className={classes}
      target="_blank"
      rel="noreferrer"
      title={source.excerpt}
    >
      {content}
    </a>
  ) : (
    <span className={classes} title={source.excerpt}>
      {content}
    </span>
  );
}

function MessageCard({
  message,
  drafts,
}: {
  message: AssistantMessageData;
  drafts: AssistantDraft[];
}) {
  const { t } = useTranslation("assistant");
  const queryClient = useQueryClient();
  const rate = useMutation(
    orpc.assistant.rateMessage.mutationOptions({
      onSuccess: async () =>
        queryClient.invalidateQueries({ queryKey: orpc.assistant.getThread.key() }),
    }),
  );
  const isUser = message.role === "user";
  return (
    <AssistantMessageScrollerItem messageId={message.id} scrollAnchor={isUser}>
      <AssistantMessage from={message.role}>
        <AssistantBubble from={message.role}>
          {isUser ? message.content : <AssistantResponse content={message.content} />}
        </AssistantBubble>

        {!isUser && message.toolCalls.length > 0 && (
          <div className="w-full space-y-2">
            {message.toolCalls.map((tool) => (
              <AssistantMarker
                key={tool.id}
                destructive={tool.status === "failed"}
                icon={
                  tool.status === "completed" ? (
                    <Check className="text-primary size-3.5" />
                  ) : (
                    <CircleAlert className="size-3.5" />
                  )
                }
              >
                <div className="flex items-center gap-2">
                  <code className="min-w-0 flex-1 truncate">{tool.name}</code>
                  <span className="text-muted-foreground">{t(`tool.${tool.status}`)}</span>
                </div>
                <p className="text-muted-foreground mt-1">{tool.summary}</p>
                {tool.error && <p className="text-destructive mt-1">{tool.error}</p>}
              </AssistantMarker>
            ))}
          </div>
        )}

        {!isUser && message.sources.length > 0 && (
          <div className="flex w-full flex-wrap gap-1.5">
            {message.sources.map((source) => (
              <SourceChip key={source.id} source={source} />
            ))}
          </div>
        )}

        {drafts.map((draft) => (
          <div key={draft.id} className="w-full">
            <AssistantDraftCard draft={draft} />
          </div>
        ))}

        {!isUser && (
          <div className="text-muted-foreground flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant={message.rating === "up" ? "secondary" : "ghost"}
              className="size-7"
              aria-label={t("rating.helpful")}
              disabled={rate.isPending}
              onClick={() =>
                rate.mutate({
                  threadId: message.threadId,
                  messageId: message.id,
                  rating: message.rating === "up" ? null : "up",
                })
              }
            >
              <ThumbsUp className="size-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant={message.rating === "down" ? "secondary" : "ghost"}
              className="size-7"
              aria-label={t("rating.notHelpful")}
              disabled={rate.isPending}
              onClick={() =>
                rate.mutate({
                  threadId: message.threadId,
                  messageId: message.id,
                  rating: message.rating === "down" ? null : "down",
                })
              }
            >
              <ThumbsDown className="size-3.5" />
            </Button>
            {message.sources.length > 0 && (
              <span className="ml-1 text-[11px]">
                {t("sources.count", { count: message.sources.length })}
              </span>
            )}
          </div>
        )}
      </AssistantMessage>
    </AssistantMessageScrollerItem>
  );
}

function errorKey(error: unknown) {
  const contractError = getOrpcError(error);
  const data = contractError?.data;
  if (data && typeof data === "object" && "code" in data && typeof data.code === "string") {
    return data.code;
  }
  if (contractError?.status === 429) return "ASSISTANT_QUOTA_EXCEEDED";
  if (contractError?.status === 403) return "ASSISTANT_DISABLED";
  if (contractError?.status === 422) return "PROVIDER_UNAVAILABLE";
  return "UNKNOWN";
}

export function AssistantPanel({ locale }: { locale: string }) {
  const { t } = useTranslation("assistant");
  const { enabled, open, setOpen } = useAssistant();
  const pathname = usePathname();
  const detail = usePlatformHeaderDetail();
  const queryClient = useQueryClient();
  const [threadId, setThreadId] = React.useState<string | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [streaming, setStreaming] = React.useState<{
    userMessage: AssistantMessageData | null;
    content: string;
    toolCalls: AssistantToolCall[];
    drafts: AssistantDraft[];
  } | null>(null);
  const context = React.useMemo(
    () => assistantContextFor(pathname, locale, detail),
    [detail, locale, pathname],
  );

  const threads = useQuery(
    orpc.assistant.listThreads.queryOptions({
      input: { limit: 50 },
      enabled: enabled && open,
    }),
  );
  const thread = useQuery(
    orpc.assistant.getThread.queryOptions({
      input: { threadId: threadId ?? "00000000-0000-4000-8000-000000000000" },
      enabled: enabled && open && !!threadId,
    }),
  );
  const usage = useQuery(
    orpc.assistant.getUsage.queryOptions({ input: {}, enabled: enabled && open }),
  );
  const chat = useMutation({
    mutationFn: async (input: AssistantChatInput): Promise<AssistantChatResponse> => {
      setStreaming({ userMessage: null, content: "", toolCalls: [], drafts: [] });
      const events = await orpcClient.assistant.chat(input);
      let result: AssistantChatResponse | null = null;

      for await (const event of events) {
        const typedEvent: AssistantChatEvent = event;
        switch (typedEvent.type) {
          case "started":
            setThreadId(typedEvent.thread.id);
            setStreaming((current) => ({
              userMessage: typedEvent.userMessage,
              content: current?.content ?? "",
              toolCalls: current?.toolCalls ?? [],
              drafts: current?.drafts ?? [],
            }));
            break;
          case "tool":
            setStreaming((current) => ({
              userMessage: current?.userMessage ?? null,
              content: current?.content ?? "",
              toolCalls: [...(current?.toolCalls ?? []), typedEvent.toolCall],
              drafts: current?.drafts ?? [],
            }));
            break;
          case "draft":
            setStreaming((current) => ({
              userMessage: current?.userMessage ?? null,
              content: current?.content ?? "",
              toolCalls: current?.toolCalls ?? [],
              drafts: [...(current?.drafts ?? []), typedEvent.draft],
            }));
            break;
          case "text-delta":
            setStreaming((current) => ({
              userMessage: current?.userMessage ?? null,
              content: (current?.content ?? "") + typedEvent.delta,
              toolCalls: current?.toolCalls ?? [],
              drafts: current?.drafts ?? [],
            }));
            break;
          case "done":
            result = typedEvent.result;
            break;
        }
      }

      if (!result) throw new Error("Assistant stream ended before the final response");
      return result;
    },
    onSuccess: async (data) => {
      setThreadId(data.thread.id);
      setMessage("");
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpc.assistant.getThread.queryKey({ input: { threadId: data.thread.id } }),
        }),
        queryClient.invalidateQueries({ queryKey: orpc.assistant.listThreads.key() }),
      ]);
      setStreaming(null);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: orpc.assistant.getUsage.key() }),
  });

  if (!enabled) return null;

  const quota = usage.data?.quota;
  const quotaPercent = quota ? Math.min(100, (quota.tokensUsed / quota.dailyTokenLimit) * 100) : 0;
  const contextLabel = context.entity?.title ?? t(`context.${context.entity?.type ?? "page"}`);
  const draftsByMessage = new Map<string, AssistantDraft[]>();
  for (const draft of thread.data?.drafts ?? []) {
    if (!draft.messageId) continue;
    draftsByMessage.set(draft.messageId, [...(draftsByMessage.get(draft.messageId) ?? []), draft]);
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || chat.isPending || quota?.exhausted) return;
    chat.mutate({
      ...(threadId ? { threadId } : {}),
      message: trimmed,
      context,
      clientRequestId: crypto.randomUUID(),
    });
  };

  const startNewThread = () => {
    setThreadId(null);
    setShowHistory(false);
    setMessage("");
    chat.reset();
    setStreaming(null);
  };

  return (
    <aside
      id="assistant-panel"
      aria-label={t("title")}
      className={cn(
        "bg-background ring-border/30 h-full min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-lg shadow-sm ring-1 md:w-[clamp(360px,24vw,440px)]",
        open ? "flex" : "hidden",
      )}
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 text-left">
        {showHistory && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t("history.back")}
            onClick={() => setShowHistory(false)}
          >
            <ArrowLeft className="size-4" />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-sm">
            <Sparkles className="text-primary size-4" />
            {showHistory ? t("history.title") : t("title")}
          </h2>
          <p className="truncate text-xs">
            {showHistory ? t("history.description") : t("description")}
          </p>
        </div>
        {!showHistory && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={t("history.open")}
              onClick={() => setShowHistory(true)}
            >
              <History className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={t("newThread")}
              onClick={startNewThread}
            >
              <MessageSquarePlus className="size-4" />
            </Button>
            <Button asChild variant="ghost" size="icon" className="size-8">
              <Link
                href={`/${locale}/platform/assistant`}
                aria-label={t("workspace.open")}
                onClick={() => setOpen(false)}
              >
                <BookOpenText className="size-4" />
              </Link>
            </Button>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label={t("close")}
          onClick={() => setOpen(false)}
        >
          <X className="size-4" />
        </Button>
      </header>

      {showHistory ? (
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-2 p-4">
            {threads.isPending && (
              <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
                <LoaderCircle className="size-4 animate-spin" />
                {t("history.loading")}
              </div>
            )}
            {threads.data?.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "hover:bg-muted focus-visible:ring-ring w-full rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2",
                  threadId === item.id && "border-primary bg-primary/5",
                )}
                onClick={() => {
                  setThreadId(item.id);
                  setShowHistory(false);
                }}
              >
                <span className="block truncate text-sm font-medium">{item.title}</span>
                <span className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                  <Clock3 className="size-3" />
                  {new Date(item.updatedAt).toLocaleString(locale)}
                </span>
              </button>
            ))}
            {!threads.isPending && threads.data?.items.length === 0 && (
              <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                {t("history.empty")}
              </div>
            )}
          </div>
        </ScrollArea>
      ) : (
        <>
          <div className="bg-muted/30 mx-4 mt-3 flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-xs">
            <span className="text-muted-foreground shrink-0">{t("context.answeringAbout")}</span>
            <span className="min-w-0 truncate font-medium">{contextLabel}</span>
            {context.entity && (
              <Badge variant="outline" className="ml-auto shrink-0 text-[10px]">
                {t(`entity.${context.entity.type}`)}
              </Badge>
            )}
          </div>

          <AssistantMessageScroller
            key={threadId ?? "new-thread"}
            busy={chat.isPending}
            label={t("thread.messagesLabel")}
            jumpLabel={t("thread.jumpToLatest")}
          >
            {thread.isPending && threadId && (
              <AssistantMessageScrollerItem messageId="thread-loading">
                <AssistantMarker icon={<LoaderCircle className="size-4 animate-spin" />}>
                  {t("thread.loading")}
                </AssistantMarker>
              </AssistantMessageScrollerItem>
            )}

            {!threadId && !chat.isPending && (
              <AssistantMessageScrollerItem messageId="empty-thread">
                <div className="space-y-5 py-6 text-center">
                  <div className="bg-primary/10 text-primary mx-auto flex size-11 items-center justify-center rounded-xl">
                    <Sparkles className="size-5" />
                  </div>
                  <div>
                    <h2 className="font-medium">{t("empty.title")}</h2>
                    <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
                      {t("empty.description")}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    {["capabilities", "findProtocol", "startExperiment"].map((prompt) => (
                      <Button
                        key={prompt}
                        variant="outline"
                        size="sm"
                        className="h-auto whitespace-normal text-left"
                        onClick={() => setMessage(t(`empty.prompts.${prompt}`))}
                      >
                        {t(`empty.prompts.${prompt}`)}
                      </Button>
                    ))}
                  </div>
                </div>
              </AssistantMessageScrollerItem>
            )}

            {thread.data?.messages
              .filter((item) => !(chat.isPending && item.id === streaming?.userMessage?.id))
              .map((item) => (
                <MessageCard
                  key={item.id}
                  message={item}
                  drafts={draftsByMessage.get(item.id) ?? []}
                />
              ))}

            {chat.isPending && (
              <>
                <AssistantMessageScrollerItem
                  messageId={
                    streaming?.userMessage?.id ?? `pending-user-${chat.variables.clientRequestId}`
                  }
                  scrollAnchor
                >
                  <AssistantMessage from="user">
                    <AssistantBubble from="user">
                      {streaming?.userMessage?.content ?? chat.variables.message}
                    </AssistantBubble>
                  </AssistantMessage>
                </AssistantMessageScrollerItem>
                <AssistantMessageScrollerItem
                  messageId={`pending-assistant-${chat.variables.clientRequestId}`}
                >
                  <AssistantMessage from="assistant">
                    {streaming?.toolCalls.map((tool) => (
                      <AssistantMarker
                        key={tool.id}
                        destructive={tool.status === "failed"}
                        icon={
                          tool.status === "completed" ? (
                            <Check className="text-primary size-3.5" />
                          ) : (
                            <CircleAlert className="size-3.5" />
                          )
                        }
                      >
                        <div className="flex items-center gap-2">
                          <code className="flex-1 truncate">{tool.name}</code>
                          <span className="text-muted-foreground">{t(`tool.${tool.status}`)}</span>
                        </div>
                        <p className="text-muted-foreground mt-1">{tool.summary}</p>
                      </AssistantMarker>
                    ))}
                    {streaming?.content ? (
                      <AssistantBubble from="assistant">
                        <AssistantResponse content={streaming.content} streaming />
                      </AssistantBubble>
                    ) : (
                      <AssistantMarker
                        icon={<LoaderCircle className="text-primary size-3.5 animate-spin" />}
                      >
                        <div className="flex items-center gap-2">
                          <code className="flex-1">{t("pending.toolLoop")}</code>
                          <span className="text-muted-foreground">{t("pending.running")}</span>
                        </div>
                        <p className="text-muted-foreground mt-1">{t("pending.description")}</p>
                      </AssistantMarker>
                    )}
                    {streaming?.drafts.map((draft) => (
                      <AssistantDraftCard key={draft.id} draft={draft} />
                    ))}
                  </AssistantMessage>
                </AssistantMessageScrollerItem>
              </>
            )}

            {chat.isError && (
              <AssistantMessageScrollerItem messageId="chat-error">
                <Alert variant="destructive">
                  <CircleAlert className="size-4" />
                  <AlertTitle>{t(`errors.${errorKey(chat.error)}.title`)}</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p>{t(`errors.${errorKey(chat.error)}.description`)}</p>
                    <Button variant="outline" size="sm" onClick={() => chat.reset()}>
                      {t("errors.dismiss")}
                    </Button>
                  </AlertDescription>
                </Alert>
              </AssistantMessageScrollerItem>
            )}
          </AssistantMessageScroller>

          <form onSubmit={submit} className="space-y-2 border-t p-4">
            {quota?.exhausted && (
              <Alert variant="destructive" className="mb-3">
                <CircleAlert className="size-4" />
                <AlertTitle>{t("quota.exhaustedTitle")}</AlertTitle>
                <AlertDescription>{t("quota.exhaustedDescription")}</AlertDescription>
              </Alert>
            )}
            <div className="relative">
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                disabled={chat.isPending || quota?.exhausted}
                placeholder={t("composer.placeholder")}
                aria-label={t("composer.label")}
                className="max-h-36 min-h-20 resize-none pr-12"
              />
              <Button
                type="submit"
                size="icon"
                className="absolute bottom-2 right-2 size-8"
                disabled={!message.trim() || chat.isPending || quota?.exhausted}
                aria-label={t("composer.send")}
              >
                {chat.isPending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
            <div className="text-muted-foreground flex items-center justify-between gap-4 text-[11px]">
              <span className="flex items-center gap-1">
                <Wrench className="size-3" />
                {t("composer.confirmationHint")}
              </span>
              {quota && (
                <span>
                  {t("quota.remaining", { count: quota.tokensRemaining.toLocaleString(locale) })}
                </span>
              )}
            </div>
            {quota && <Progress value={quotaPercent} className="h-1" />}
          </form>
        </>
      )}
    </aside>
  );
}
