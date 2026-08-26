"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { cn } from "@repo/ui/lib/utils";

interface PanelCardProps {
  title: string;
  description?: string;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

/** The dashboard's shared panel chrome. */
export function PanelCard({
  title,
  description,
  className,
  contentClassName,
  children,
}: PanelCardProps) {
  return (
    <Card className={cn("shadow-none", className)}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description !== undefined && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}
