"use client";

import {
  Bell,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCw,
  Upload,
  XCircle,
} from "lucide-react";
import * as React from "react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/ui/components/popover";
import { ScrollArea } from "@repo/ui/components/scroll-area";
import { cn } from "@repo/ui/lib/utils";

type JobKind = "data_export" | "ambyte_processing" | "metadata_reprocess";
type JobStatus = "queued" | "running" | "succeeded" | "failed";

interface JobRun {
  id: string;
  kind: JobKind;
  title: string;
  status: JobStatus;
  updatedAt: string; // ISO
  resultUrl?: string;
}

// Mock data — replace with /job-runs in the OJD-1506 implementation.
const MOCK_JOBS: JobRun[] = [
  {
    id: "1",
    kind: "data_export",
    title: "Export of Light Response 03",
    status: "running",
    updatedAt: new Date(Date.now() - 30 * 1000).toISOString(),
  },
  {
    id: "2",
    kind: "data_export",
    title: "Export of Photosynthesis Curves",
    status: "succeeded",
    updatedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
    resultUrl: "#",
  },
  {
    id: "3",
    kind: "ambyte_processing",
    title: "Ambyte upload — soil moisture batch",
    status: "failed",
    updatedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
  },
];

const NOTIFICATION_BELL_TOGGLE_EVENT = "openjii:toggle-notification-bell";

function kindIcon(kind: JobKind) {
  if (kind === "data_export") return Database;
  if (kind === "ambyte_processing") return Upload;
  return RefreshCw;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function statusBadge(status: JobStatus) {
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[hsl(180_100%_18.4%)] dark:text-[hsl(136_74%_58%)]">
        <Loader2 className="size-3 animate-spin" />
        Running
      </span>
    );
  }
  if (status === "succeeded") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[hsl(136_50%_35%)] dark:text-[hsl(136_74%_58%)]">
        <CheckCircle2 className="size-3" />
        Succeeded
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive">
        <XCircle className="size-3" />
        Failed
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-muted-foreground">Queued</span>
  );
}

export function ActivityPopover({ className }: { className?: string }) {
  const [open, setOpen] = React.useState(false);
  const [jobs] = React.useState<JobRun[]>(MOCK_JOBS);
  const unread = jobs.filter((j) => j.status === "running" || j.status === "failed").length;

  React.useEffect(() => {
    const onToggle = () => setOpen((o) => !o);
    window.addEventListener(NOTIFICATION_BELL_TOGGLE_EVENT, onToggle);
    return () => window.removeEventListener(NOTIFICATION_BELL_TOGGLE_EVENT, onToggle);
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Activity${unread > 0 ? ` (${unread} unread)` : ""}`}
          className={cn(
            "relative inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-1 top-1 size-1.5 rounded-full bg-[hsl(136_74%_58%)]"
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-[360px] p-0"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Activity</h3>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Mark all read
          </button>
        </div>
        <ScrollArea className="max-h-[400px]">
          {jobs.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Nothing to show. Long-running tasks like exports and uploads will appear here.
            </div>
          ) : (
            <ul className="divide-y">
              {jobs.map((job) => {
                const Icon = kindIcon(job.kind);
                return (
                  <li key={job.id}>
                    <a
                      href={job.resultUrl ?? "#"}
                      className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:bg-muted/50"
                    >
                      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{job.title}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          {statusBadge(job.status)}
                          <span className="text-xs text-muted-foreground">
                            · {relativeTime(job.updatedAt)}
                          </span>
                        </div>
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t bg-muted/30 px-4 py-2">
          <a
            href="#"
            className="text-xs font-medium text-primary hover:underline"
          >
            Open all activity →
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { NOTIFICATION_BELL_TOGGLE_EVENT };
