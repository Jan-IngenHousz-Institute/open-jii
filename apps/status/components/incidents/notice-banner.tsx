import { CircleAlert, Info, OctagonX } from "lucide-react";

import type { Notice } from "@repo/monitoring/status-document";
import { Alert, AlertDescription } from "@repo/ui/components/alert";

const SEVERITY = {
  info: { icon: Info, className: "" },
  warning: { icon: CircleAlert, className: "border-status-stale-foreground" },
  critical: { icon: OctagonX, className: "border-destructive" },
};

export function NoticeBanner({ notice }: { notice: Notice }) {
  const { icon: Icon, className } = SEVERITY[notice.severity];
  const role = notice.severity === "critical" ? "alert" : "status";

  return (
    <Alert role={role} className={className}>
      <Icon aria-hidden />
      <p className="col-start-2 font-medium">{notice.title}</p>
      {notice.body === "" ? null : (
        <AlertDescription className="whitespace-pre-line">{notice.body}</AlertDescription>
      )}
    </Alert>
  );
}
