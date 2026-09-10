"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

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
  footer?: ReactNode;
  className?: string;
}

/**
 * One figure of a metrics band. A period-over-period badge sits with the
 * number and the qualifier sits under it, so the card reads top to bottom
 * without the reader hunting for what the figure is measured against.
 */
export function MetricStatCard({
  label,
  value,
  locale,
  title,
  change = null,
  footer,
  className,
}: MetricStatCardProps) {
  const renderChange = (fraction: number) => {
    const Icon = fraction >= 0 ? TrendingUp : TrendingDown;
    const percent = new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 0,
      signDisplay: "exceptZero",
    }).format(fraction);

    return (
      <Badge variant="outline" className="gap-1 tabular-nums">
        <Icon aria-hidden className="size-3" />
        {percent}
      </Badge>
    );
  };

  return (
    <Card className={cn("@container/card gap-3 py-5", className)}>
      <CardHeader className="gap-1">
        <CardDescription className="text-xs font-medium uppercase tracking-wide">
          {label}
        </CardDescription>
        <CardTitle
          title={title}
          className="@[220px]/card:text-3xl text-2xl font-semibold tabular-nums"
        >
          {value}
        </CardTitle>
        {change === null ? null : <CardAction>{renderChange(change)}</CardAction>}
      </CardHeader>
      {footer === undefined ? null : (
        <CardFooter className="text-muted-foreground text-xs">{footer}</CardFooter>
      )}
    </Card>
  );
}
