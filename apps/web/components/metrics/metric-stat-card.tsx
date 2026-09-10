"use client";

import { TrendingDown, TrendingUp } from "lucide-react";

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

interface MetricStatCardProps {
  label: string;
  value: string;
  locale: string;
  /** The full figure behind an abbreviated `value`, shown on hover. */
  title?: string;
  /** Share of change against the window before, as a fraction. Null hides the badge. */
  change?: number | null;
  /** Leading footer line: what the figure says. */
  note?: string;
  /** Trailing footer line: what it is measured over. */
  context?: string;
  className?: string;
}

/**
 * One figure of a metrics band. A period-over-period badge sits with the
 * number and the qualifiers sit under it, so the card reads top to bottom
 * without the reader hunting for what the figure is measured against.
 */
export function MetricStatCard({
  label,
  value,
  locale,
  title,
  change = null,
  note,
  context,
  className,
}: MetricStatCardProps) {
  const hasFooter = note !== undefined || context !== undefined;

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
    <Card
      className={cn(
        "@container/card from-primary/5 to-card dark:bg-card bg-linear-to-t shadow-xs gap-3 py-4",
        className,
      )}
    >
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle
          title={title}
          className="line-clamp-1 min-w-0 text-2xl font-semibold tabular-nums"
        >
          {value}
        </CardTitle>
        {change === null ? null : <CardAction>{renderChange(change)}</CardAction>}
      </CardHeader>
      {hasFooter ? (
        <CardFooter className="mt-auto flex-col items-start gap-0.5 text-sm">
          {note === undefined ? null : renderNote(note)}
          {context === undefined ? null : <div className="text-muted-foreground">{context}</div>}
        </CardFooter>
      ) : null}
    </Card>
  );
}
