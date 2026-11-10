import type { ReactNode } from "react";

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
      {children}
    </h2>
  );
}
