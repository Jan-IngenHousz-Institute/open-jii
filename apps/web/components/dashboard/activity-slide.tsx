import type { ReactNode } from "react";

interface ActivitySlideProps {
  label: string;
  value: string;
  /** The full figure behind an abbreviated value, shown on hover. */
  title?: string;
  /** Beside the value, such as the change against the previous window. */
  badge?: ReactNode;
  /** Short lines under the value. */
  notes: ReactNode;
  /** Sits at the slide's foot, so charts line up whatever the notes above them. */
  chart?: ReactNode;
}

/** One figure of the home's 30 days: a label, the value, a few notes and an optional chart. */
export function ActivitySlide({ label, value, title, badge, notes, chart }: ActivitySlideProps) {
  return (
    <div className="flex h-full flex-col gap-1">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <span className="flex items-baseline gap-2" title={title}>
        <span className="text-2xl font-bold tabular-nums tracking-tight">{value}</span>
        {badge}
      </span>
      <div className="text-muted-foreground flex flex-wrap gap-x-3.5 gap-y-0.5 text-xs">
        {notes}
      </div>
      {chart ? <div className="mt-auto pt-2">{chart}</div> : null}
    </div>
  );
}
