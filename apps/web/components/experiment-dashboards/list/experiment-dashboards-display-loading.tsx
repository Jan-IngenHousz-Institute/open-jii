import { Loader2 } from "lucide-react";

export function ExperimentDashboardsDisplayLoading() {
  return (
    <div className="text-muted-foreground flex h-32 items-center justify-center gap-2">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}
