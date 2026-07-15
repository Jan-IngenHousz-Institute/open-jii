"use client";

import { FlaskConical } from "lucide-react";

import type { DeviceExperiment } from "@repo/api/schemas/iot.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

export function DeviceBoundExperimentRow({ experiment }: { experiment: DeviceExperiment }) {
  const { t: tExperiments } = useTranslation("experiments");

  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <FlaskConical className="text-muted-foreground h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{experiment.name}</span>
      <Badge variant="outline" className="shrink-0">
        {tExperiments(`status.${experiment.status}`)}
      </Badge>
    </li>
  );
}
