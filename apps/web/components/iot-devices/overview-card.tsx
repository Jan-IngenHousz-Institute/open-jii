"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";

interface OverviewCardProps {
  /** Glyph for the well; sized by the well itself. */
  icon: ReactNode;
  /** The well's tint; each subject carries its own so the cards stop reading
   * as one repeated box. */
  wellClassName?: string;
  title: string;
  /** Small addition beside the title, e.g. a count badge. */
  titleExtra?: ReactNode;
  link?: { href: string; label: string };
  children: ReactNode;
}

/**
 * The stitched-hub card shell: an icon well naming the subject at a glance, a
 * title, and one link into the tab the card summarises. Shared so every card
 * on the overview carries the same weight.
 */
export function OverviewCard({
  icon,
  wellClassName,
  title,
  titleExtra,
  link,
  children,
}: OverviewCardProps) {
  return (
    <Card className="shadow-xs flex min-w-0 flex-col rounded-xl transition-shadow hover:shadow-sm">
      {/* CardHeader is a grid, so the well, title and link have to share one
          cell to sit on a line; `flex-row` on the header itself is inert and
          used to drop each of them onto its own row. The link belongs in
          CardAction, which is the column the grid grows for it. */}
      <CardHeader>
        <CardTitle className="flex min-w-0 items-center gap-3 text-base font-semibold tracking-tight">
          <span
            className={cn(
              "bg-secondary text-primary flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4",
              wellClassName,
            )}
          >
            {icon}
          </span>
          <span className="min-w-0 truncate">{title}</span>
          {titleExtra}
        </CardTitle>
        {link !== undefined && (
          <CardAction>
            <Link
              href={link.href}
              className="text-primary shrink-0 text-sm font-medium hover:underline"
            >
              {link.label}
            </Link>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="min-w-0 flex-1">{children}</CardContent>
    </Card>
  );
}
