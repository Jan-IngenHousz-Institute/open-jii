"use client";

import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";

import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";

// Past ten-fold a percentage says less than the two figures, which the footer
// carries anyway.
const MAX_DISPLAYED_CHANGE = 10;

function displayableChange(comparison?: { current: number; previous: number }): number | null {
  if (comparison === undefined || comparison.previous <= 0) {
    return null;
  }

  const change = (comparison.current - comparison.previous) / comparison.previous;
  return Math.abs(change) > MAX_DISPLAYED_CHANGE ? null : change;
}

interface MetricStatCardProps {
  label: string;
  value: string;
  locale: string;
  /** The full figure behind an abbreviated `value`, shown on hover. */
  title?: string;
  comparison?: { current: number; previous: number };
  href?: string;
  note?: string;
  context?: string;
  className?: string;
}

/** One figure of a metrics band: the number, its change, and what it is measured over. */
export function MetricStatCard({
  label,
  value,
  locale,
  title,
  comparison,
  href,
  note,
  context,
  className,
}: MetricStatCardProps) {
  const hasFooter = note !== undefined || context !== undefined;
  const change = displayableChange(comparison);

  const renderChange = (fraction: number) => {
    const Icon = fraction >= 0 ? TrendingUp : TrendingDown;
    const percent = new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 0,
      signDisplay: "exceptZero",
    }).format(fraction);

    return (
      <Badge variant="outline" className="tabular-nums">
        <Icon aria-hidden />
        {percent}
      </Badge>
    );
  };

  const renderLinkedValue = (target: string) => (
    <Link href={target} className="hover:text-primary flex items-center gap-1.5 transition-colors">
      <span className="truncate">{value}</span>
      <ArrowUpRight aria-hidden className="size-5 shrink-0 opacity-60" />
    </Link>
  );

  const renderNote = (text: string) => (
    <div className="line-clamp-1 flex gap-2 font-medium">
      {text}
      {change === null ? null : change >= 0 ? (
        <TrendingUp aria-hidden className="size-4" />
      ) : (
        <TrendingDown aria-hidden className="size-4" />
      )}
    </div>
  );

  return (
    <Card padding="sm" className={cn("@container/card", className)}>
      <CardHeader className="gap-1">
        <CardDescription>{label}</CardDescription>
        <CardTitle
          title={title}
          className="line-clamp-1 min-w-0 text-2xl font-semibold tabular-nums"
        >
          {href === undefined ? value : renderLinkedValue(href)}
        </CardTitle>
        {/* The note below already prints a trend arrow, so in a half-width card
            the badge is a second reading of the same thing in the space the
            figure needs. Container query, not a breakpoint: what matters is how
            wide this card ended up, not how wide the window is. */}
        {change === null ? null : (
          <CardAction className="@[10rem]/card:block hidden">{renderChange(change)}</CardAction>
        )}
      </CardHeader>
      {hasFooter ? (
        <CardFooter className="mt-auto flex-col items-start gap-0.5 text-xs">
          {note === undefined ? null : renderNote(note)}
          {context === undefined ? null : (
            <div className="text-muted-foreground @[10rem]/card:block hidden">{context}</div>
          )}
        </CardFooter>
      ) : null}
    </Card>
  );
}
