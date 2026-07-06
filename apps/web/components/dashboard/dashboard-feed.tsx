"use client";

import { useLocale } from "@/hooks/useLocale";
import { tsr } from "@/lib/tsr";
import {
  Beaker,
  Building2,
  FileCode,
  FlaskConical,
  Globe,
  Lock,
  NotebookPen,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import type { FeedItem, FeedItemKind } from "@repo/api/schemas/feed.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Skeleton } from "@repo/ui/components/skeleton";

const KIND_ICONS: Record<FeedItemKind, LucideIcon> = {
  experiment: FlaskConical,
  protocol: FileCode,
  macro: Beaker,
  workbook: NotebookPen,
  "organization-joined": Users,
};

function feedHref(item: FeedItem, locale: string): string {
  switch (item.kind) {
    case "experiment":
      return `/${locale}/platform/experiments/${item.id}`;
    case "protocol":
      return `/${locale}/platform/protocols/${item.id}`;
    case "macro":
      return `/${locale}/platform/macros/${item.id}`;
    case "workbook":
      return `/${locale}/platform/workbooks/${item.id}`;
    case "organization-joined":
      return `/${locale}/platform/organizations/${item.id}`;
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function DashboardFeed() {
  const { t } = useTranslation("common");
  const locale = useLocale();
  const { data, isLoading } = tsr.feed.getFeed.useQuery({
    queryData: { query: { limit: 20 } },
    queryKey: ["feed"],
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const items = data?.body ?? [];

  if (items.length === 0) {
    return (
      <div className="text-muted-foreground rounded-lg border border-dashed px-6 py-10 text-center text-sm">
        {t("dashboard.feedEmpty")}
      </div>
    );
  }

  return (
    <ol className="divide-border divide-y overflow-hidden rounded-lg border">
      {items.map((item) => {
        const Icon = KIND_ICONS[item.kind];
        const isJoin = item.kind === "organization-joined";
        const title = isJoin ? t("dashboard.feedJoinedOrg", { name: item.title }) : item.title;
        return (
          <li key={`${item.kind}-${item.id}`}>
            <Link
              href={feedHref(item, locale)}
              className="hover:bg-muted/50 flex items-start gap-3 px-4 py-3 transition-colors"
            >
              <span className="bg-primary/10 text-primary mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{title}</span>
                  {item.organizationName && !isJoin && (
                    <Badge variant="outline" className="gap-1">
                      <Building2 className="h-3 w-3" />
                      {item.organizationName}
                    </Badge>
                  )}
                  {item.visibility && (
                    <Badge variant="secondary" className="gap-1">
                      {item.visibility === "public" ? (
                        <Globe className="h-3 w-3" />
                      ) : (
                        <Lock className="h-3 w-3" />
                      )}
                      {item.visibility === "public"
                        ? t("dashboard.feedPublic")
                        : t("dashboard.feedPrivate")}
                    </Badge>
                  )}
                </span>
                <span className="text-muted-foreground mt-0.5 block text-xs">
                  {relativeTime(item.timestamp)}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
