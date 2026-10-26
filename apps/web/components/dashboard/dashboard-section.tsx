import type { ReactNode } from "react";

interface DashboardSectionProps {
  /** Names the heading, so the section is announced by it. */
  id: string;
  title: string;
  /** Quieter text beside the heading, such as a count. */
  meta?: ReactNode;
  /** At the heading's far end, usually a See all link. */
  action?: ReactNode;
  children: ReactNode;
}

/** One section of the home: a heading row, then its content. */
export function DashboardSection({ id, title, meta, action, children }: DashboardSectionProps) {
  const headingId = `${id}-heading`;

  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id={headingId} className="text-foreground text-base font-bold leading-tight">
          {title}
          {meta ? (
            <span className="text-muted-foreground ml-2 text-sm font-normal">{meta}</span>
          ) : null}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
