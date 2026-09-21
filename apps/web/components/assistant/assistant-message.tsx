"use client";

import { MessageScroller } from "@shadcn/react/message-scroller";
import { code } from "@streamdown/code";
import { ChevronDown, FileText, X } from "lucide-react";
import * as React from "react";
import { defaultUrlTransform, Streamdown } from "streamdown";
import { env } from "~/env";

import { Button } from "@repo/ui/components/button";
import { cn } from "@repo/ui/lib/utils";

import { resolveAssistantSourceLink } from "./assistant-source-link";

export function AssistantMessageScroller({
  children,
  busy,
  label,
  jumpLabel,
  className,
}: {
  children: React.ReactNode;
  busy: boolean;
  label: string;
  jumpLabel: string;
  className?: string;
}) {
  return (
    <MessageScroller.Provider
      autoScroll
      defaultScrollPosition="last-anchor"
      scrollPreviousItemPeek={72}
    >
      <MessageScroller.Root
        className={cn("relative flex min-h-0 flex-1 flex-col overflow-hidden", className)}
      >
        <MessageScroller.Viewport
          aria-label={label}
          className="focus-visible:ring-ring flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
        >
          <MessageScroller.Content
            aria-busy={busy}
            className="flex min-h-full flex-col gap-5 p-4"
            spacerClassName="shrink-0"
          >
            {children}
          </MessageScroller.Content>
        </MessageScroller.Viewport>
        <MessageScroller.Button
          behavior="smooth"
          className="bg-background text-foreground hover:bg-muted focus-visible:ring-ring absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-md transition focus-visible:outline-none focus-visible:ring-2 data-[active=false]:pointer-events-none data-[active=false]:opacity-0"
        >
          <ChevronDown className="size-3.5" aria-hidden />
          <span>{jumpLabel}</span>
        </MessageScroller.Button>
      </MessageScroller.Root>
    </MessageScroller.Provider>
  );
}

export function AssistantMessageScrollerItem({
  messageId,
  scrollAnchor = false,
  children,
  className,
}: {
  messageId: string;
  scrollAnchor?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <MessageScroller.Item
      messageId={messageId}
      scrollAnchor={scrollAnchor}
      className={cn("[contain-intrinsic-size:auto_96px] [content-visibility:auto]", className)}
    >
      {children}
    </MessageScroller.Item>
  );
}

export function AssistantMessage({
  from,
  children,
  className,
}: {
  from: "user" | "assistant";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article
      data-from={from}
      className={cn(
        "flex w-full flex-col gap-2",
        from === "user" ? "items-end" : "items-start",
        className,
      )}
    >
      {children}
    </article>
  );
}

export function AssistantBubble({
  from,
  children,
  className,
}: {
  from: "user" | "assistant";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "max-w-[92%] rounded-xl px-3 py-2.5 text-sm leading-relaxed",
        from === "user"
          ? "bg-primary text-primary-foreground whitespace-pre-wrap rounded-br-sm"
          : "bg-muted text-foreground rounded-bl-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AssistantResponse({
  content,
  streaming = false,
}: {
  content: string;
  streaming?: boolean;
}) {
  return (
    <Streamdown
      urlTransform={(url, key, node) =>
        defaultUrlTransform(
          key === "href"
            ? resolveAssistantSourceLink(url, env.NEXT_PUBLIC_DOCS_URL, env.NEXT_PUBLIC_BASE_URL)
            : url,
          key,
          node,
        )
      }
      mode={streaming ? "streaming" : "static"}
      parseIncompleteMarkdown={streaming}
      caret={streaming ? "block" : undefined}
      plugins={{ code }}
      controls={{ code: { copy: true, download: false }, table: { copy: true, download: false } }}
      lineNumbers
      linkSafety={{ enabled: true }}
      className="[&_a]:text-primary [&_code:not(pre_code)]:bg-background/70 [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_code:not(pre_code)]:rounded [&_code:not(pre_code)]:px-1 [&_ol]:ml-5 [&_ol]:list-decimal [&_p+p]:mt-3 [&_pre]:max-w-full [&_table]:text-xs [&_ul]:ml-5 [&_ul]:list-disc"
    >
      {content}
    </Streamdown>
  );
}

export function AssistantMarker({
  children,
  icon,
  destructive = false,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <div
      role="status"
      className={cn(
        "bg-card flex items-start gap-2 rounded-lg border px-3 py-2 text-xs",
        destructive && "border-destructive/40 text-destructive",
      )}
    >
      <span className="mt-0.5 shrink-0" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function AssistantAttachment({
  name,
  mediaType,
  detail,
  onRemove,
  removeLabel,
}: {
  name: string;
  mediaType?: string;
  detail?: string;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <div className="bg-muted/40 flex min-w-0 items-center gap-3 rounded-lg border p-2.5">
      <span className="bg-background text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-md border">
        <FileText className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name}</span>
        {(mediaType ?? detail) && (
          <span className="text-muted-foreground block truncate text-xs">
            {[mediaType, detail].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          aria-label={removeLabel}
          onClick={onRemove}
        >
          <X className="size-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}
