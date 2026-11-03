"use client";

import { CircleCheck, CircleHelp, OctagonX, TriangleAlert, Wrench } from "lucide-react";
import { useHeadline } from "~/hooks/use-headline";
import type { HeadlineInput } from "~/hooks/use-headline";

import { Card } from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";

import { ContactLine } from "./contact-line";

const SEVERITY = {
  operational: {
    icon: CircleCheck,
    iconColor: "text-status-active-foreground",
  },
  degraded: {
    icon: TriangleAlert,
    iconColor: "text-status-stale-foreground",
  },
  outage: {
    icon: OctagonX,
    iconColor: "text-destructive",
  },
  maintenance: {
    icon: Wrench,
    iconColor: "text-status-published-foreground",
  },
  stale: {
    icon: CircleHelp,
    iconColor: "text-status-archived-foreground",
  },
};

export function StatusHeadline(props: HeadlineInput) {
  const { severity, title, description } = useHeadline(props);
  const { icon: Icon, iconColor } = SEVERITY[severity];
  const hasDescription = description !== "";
  const hasContactLine = severity === "operational";

  return (
    <Card padding="none" className="flex-row items-center gap-4 px-6 py-5">
      <Icon className={cn("size-7 shrink-0", iconColor)} aria-hidden />
      <div>
        <div role="status" aria-atomic="true">
          <p className="text-lg font-semibold">{title}</p>
          {hasDescription ? <p className="text-muted-foreground text-sm">{description}</p> : null}
        </div>
        {hasContactLine ? <ContactLine i18nKey="headline.operational.help" /> : null}
      </div>
    </Card>
  );
}
