"use client";

import type { Experiment } from "@repo/api/schemas/experiment.schema";
import { Checkbox } from "@repo/ui/components/checkbox";

interface DeviceSelectableExperimentRowProps {
  experiment: Experiment;
  isSelected: boolean;
  onToggle: (experimentId: string, checked: boolean) => void;
}

export function DeviceSelectableExperimentRow({
  experiment,
  isSelected,
  onToggle,
}: DeviceSelectableExperimentRowProps) {
  const handleCheckedChange = (checked: boolean | "indeterminate") => {
    onToggle(experiment.id, checked === true);
  };

  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <Checkbox
        id={`onboard-${experiment.id}`}
        checked={isSelected}
        onCheckedChange={handleCheckedChange}
      />
      <label
        htmlFor={`onboard-${experiment.id}`}
        className="min-w-0 flex-1 cursor-pointer truncate text-sm"
      >
        {experiment.name}
      </label>
    </li>
  );
}
