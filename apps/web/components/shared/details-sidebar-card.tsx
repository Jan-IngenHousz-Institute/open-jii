"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@repo/ui/components/button";
import { Card, CardContent, CardHeader } from "@repo/ui/components/card";
import { cva } from "@repo/ui/lib/utils";

const toggleButtonVariants = cva(
  "absolute right-4 z-20 flex items-center justify-center md:hidden dark:bg-gray-900/80",
  {
    variants: {
      collapsed: {
        true: "top-1/2 -translate-y-1/2",
        false: "top-4 translate-y-0",
      },
    },
  },
);

interface DetailsSidebarCardProps {
  title: string;
  collapsedSummary?: string;
  children: ReactNode;
}

export function DetailsSidebarCard({ title, collapsedSummary, children }: DetailsSidebarCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  return (
    <div className="w-full md:order-2 md:w-96">
      <Card className="relative shadow-none">
        <Button
          onClick={() => setIsCollapsed(!isCollapsed)}
          variant="ghost"
          className={toggleButtonVariants({ collapsed: isCollapsed })}
        >
          {isCollapsed ? (
            <ChevronDown className="!h-6 !w-6" />
          ) : (
            <ChevronUp className="!h-6 !w-6" />
          )}
        </Button>

        <CardHeader>
          <h3 className="text-lg font-semibold">{title}</h3>
        </CardHeader>

        {isCollapsed && collapsedSummary && (
          <div className="text-muted-foreground -mt-6 truncate px-6 pb-3 text-sm md:hidden">
            {collapsedSummary}
          </div>
        )}

        <div className={`md:block ${isCollapsed ? "hidden" : "block"}`}>
          <CardContent className="space-y-4">{children}</CardContent>
        </div>
      </Card>
    </div>
  );
}
