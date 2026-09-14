"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader } from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";

interface DetailsSidebarCardProps {
  title: string;
  collapsedSummary?: string;
  children: ReactNode;
}

export function DetailsSidebarCard({ title, collapsedSummary, children }: DetailsSidebarCardProps) {
  const { t } = useTranslation("common");
  const [isCollapsed, setIsCollapsed] = useState(true);
  const showsSummary = isCollapsed && collapsedSummary !== undefined;

  // Side-by-side waits for lg, not md: an open 232px sidebar leaves ~544px at
  // 768px, which is not two columns.
  return (
    <div className="w-full lg:order-2 lg:w-96">
      <Card padding="sm" className={cn("relative shadow-none", isCollapsed && "pb-0 lg:pb-3")}>
        {/* Beside the title, not centred: a ghost Button with no size inherits
            h-9 px-4, which on a collapsed card lands below the title row. */}
        <Button
          onClick={() => setIsCollapsed(!isCollapsed)}
          variant="ghost"
          size="icon"
          className="absolute right-2 top-[10px] z-20 h-8 w-8 lg:hidden"
          aria-label={isCollapsed ? t("common.expandDetails") : t("common.collapseDetails")}
        >
          {isCollapsed ? (
            <ChevronDown className="!h-5 !w-5" />
          ) : (
            <ChevronUp className="!h-5 !w-5" />
          )}
        </Button>

        <CardHeader className="pr-10">
          <h3 className="text-lg font-semibold">{title}</h3>
        </CardHeader>

        {showsSummary && (
          // -mt-2 cancels the card's gap-2 so the line sits under the title.
          <div className="text-muted-foreground -mt-2 truncate px-6 pb-3 text-sm lg:hidden">
            {collapsedSummary}
          </div>
        )}

        <div className={cn("lg:block", isCollapsed ? "hidden" : "block")}>
          <CardContent className="space-y-4">{children}</CardContent>
        </div>
      </Card>
    </div>
  );
}
