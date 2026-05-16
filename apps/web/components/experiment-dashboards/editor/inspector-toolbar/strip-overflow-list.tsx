"use client";

import { Settings2 } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Button } from "@repo/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/components/popover";

import { useStripOverflow } from "../hooks/use-strip-overflow";
import type { StripOverflowItem } from "../hooks/use-strip-overflow";

export type { StripOverflowItem };

interface StripOverflowListProps {
  items: StripOverflowItem[];
  /** Extra px to reserve for sibling controls (separators, kebab) in the parent flex row. */
  trailingSafetyPx?: number;
}

// Horizontal strip with overflow spilling into a "More" popover. The
// width math lives in `useStripOverflow`; this component only renders
// the live row, the shadow mirror, and the popover.
export function StripOverflowList({ items, trailingSafetyPx = 0 }: StripOverflowListProps) {
  const { t } = useTranslation("experimentDashboards");
  const { containerRef, shadowItemsRef, shadowMoreRef, splitAt } = useStripOverflow({
    items,
    trailingSafetyPx,
  });

  const safeSplit = Math.min(splitAt, items.length);
  const visibleItems = items.slice(0, safeSplit);
  const overflowItems = items.slice(safeSplit);

  const moreButtonLabel = t("editor.inspector.moreShelves");

  return (
    <>
      <div ref={containerRef} className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
        {visibleItems.map((item) => (
          <div key={item.key} className="shrink-0">
            {item.node}
          </div>
        ))}

        {overflowItems.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-label={moreButtonLabel}
                className="text-muted-foreground hover:text-foreground hover:bg-accent h-8 shrink-0 gap-1.5 rounded-full px-2.5 text-xs"
              >
                <Settings2 className="size-3.5" />
                <span className="hidden font-medium md:inline">{moreButtonLabel}</span>
                <span className="text-muted-foreground hidden font-normal md:inline">
                  +{overflowItems.length}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-auto min-w-[14rem] p-1.5">
              <div className="flex flex-col gap-0.5">
                {overflowItems.map((item) => (
                  <div key={item.key}>{item.node}</div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Shadow row: identical render for measurement only. Lives outside
          the live container so trimming the visible row doesn't shrink
          the source-of-truth widths. Shadow More mirrors the live button
          so its width is known before the live one mounts. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-[9999px] -top-[9999px] flex items-center gap-1 opacity-0"
      >
        <div ref={shadowItemsRef} className="flex items-center gap-1">
          {items.map((item) => (
            <div key={item.key} className="shrink-0">
              {item.node}
            </div>
          ))}
        </div>
        <Button
          ref={shadowMoreRef}
          variant="ghost"
          size="sm"
          tabIndex={-1}
          className="text-muted-foreground hover:text-foreground hover:bg-accent h-8 shrink-0 gap-1.5 rounded-full px-2.5 text-xs"
        >
          <Settings2 className="size-3.5" />
          <span className="hidden font-medium md:inline">{moreButtonLabel}</span>
          <span className="text-muted-foreground hidden font-normal md:inline">
            +{items.length}
          </span>
        </Button>
      </div>
    </>
  );
}
