"use client";

import type { ReactNode } from "react";

interface PeopleGroupProps {
  title: string;
  help: string;
  testId: string;
  children: ReactNode;
}

/** One of Describe's groups of people, under a small heading that says what the group means. */
export function PeopleGroup({ title, help, testId, children }: PeopleGroupProps) {
  return (
    <section className="space-y-1" data-testid={testId}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="text-muted-foreground text-xs">{help}</p>
      </div>
      {children}
    </section>
  );
}
