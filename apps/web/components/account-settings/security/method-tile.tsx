import type { ReactNode } from "react";

export function MethodTile({
  icon,
  iconTone = "muted",
  title,
  status,
  action,
  note,
}: {
  icon: ReactNode;
  iconTone?: "muted" | "secondary";
  title: string;
  status: ReactNode;
  action?: ReactNode;
  note?: string;
}) {
  return (
    <div className="rounded-lg border p-3.5">
      <div className="flex items-center gap-3">
        <div
          className={
            iconTone === "secondary"
              ? "bg-secondary text-secondary-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              : "bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
          }
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-muted-foreground wrap-anywhere text-xs">{status}</p>
        </div>
        {action}
      </div>
      {note && <p className="text-muted-foreground pl-13 mt-2.5 text-xs">{note}</p>}
    </div>
  );
}
