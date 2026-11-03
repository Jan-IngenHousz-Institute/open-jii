"use client";

import { CircleCheck, OctagonX, TriangleAlert, Wrench } from "lucide-react";

import { useTranslation } from "@repo/i18n/client";
import { Badge } from "@repo/ui/components/badge";
import { cn } from "@repo/ui/lib/utils";

const STYLES = {
  operational: {
    icon: CircleCheck,
    className: "bg-status-active text-status-active-foreground",
  },
  degraded: {
    icon: TriangleAlert,
    className: "bg-status-stale text-status-stale-foreground",
  },
  outage: {
    icon: OctagonX,
    className: "bg-destructive text-destructive-foreground",
  },
  maintenance: {
    icon: Wrench,
    className: "bg-status-published text-status-published-foreground",
  },
  resolved: {
    icon: CircleCheck,
    className: "bg-status-active text-status-active-foreground",
  },
  scheduled: {
    icon: Wrench,
    className: "bg-status-published text-status-published-foreground",
  },
  "in-progress": {
    icon: Wrench,
    className: "bg-status-published text-status-published-foreground",
  },
  completed: {
    icon: Wrench,
    className: "bg-status-published text-status-published-foreground",
  },
};

const MUTED = "bg-status-archived text-status-archived-foreground";

interface StatusBadgeProps {
  state: keyof typeof STYLES;
  isMuted?: boolean;
}

export function StatusBadge({ state, isMuted = false }: StatusBadgeProps) {
  const { t } = useTranslation("status");
  const { icon: Icon, className } = STYLES[state];

  return (
    <Badge
      variant="secondary"
      className={cn("gap-1.5 px-2.5 py-1 text-sm [&>svg]:size-4", isMuted ? MUTED : className)}
    >
      <Icon aria-hidden />
      {t(`badge.${state}`)}
    </Badge>
  );
}
