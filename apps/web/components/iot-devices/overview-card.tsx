"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/card";

interface OverviewCardProps {
  /** Glyph for the well; sized by the well itself. */
  icon: ReactNode;
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
export function OverviewCard({ icon, title, titleExtra, link, children }: OverviewCardProps) {
  return (
    <Card className="flex flex-col shadow-none">
      <CardHeader className="flex-row items-center gap-3 space-y-0">
        <div className="bg-secondary text-primary flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4">
          {icon}
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
        {titleExtra}
        {link !== undefined && (
          <Link
            href={link.href}
            className="text-primary ml-auto shrink-0 text-sm font-medium hover:underline"
          >
            {link.label}
          </Link>
        )}
      </CardHeader>
      <CardContent className="flex-1">{children}</CardContent>
    </Card>
  );
}
