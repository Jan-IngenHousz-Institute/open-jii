"use client";

import { Check } from "lucide-react";

import { CommandItem } from "@repo/ui/components/command";
import { cn } from "@repo/ui/lib/utils";

import { ContributorIdentity } from "../../contributor/contributor-identity";
import { deviceDisplayName } from "../../experiment-visualizations/charts/data/device-cells";

export interface CategoricalOptionProps {
  optionValue: string;
  isSelected: boolean;
  isContributor: boolean;
  isDevice: boolean;
  onSelect: () => void;
}

export function CategoricalOption({
  optionValue,
  isSelected,
  isContributor,
  isDevice,
  onSelect,
}: CategoricalOptionProps) {
  return (
    <CommandItem value={optionValue} onSelect={onSelect}>
      <Check className={cn("mr-2 h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
      {isContributor ? (
        <ContributorIdentity data={optionValue} size="compact" />
      ) : isDevice ? (
        <span className="truncate">{deviceDisplayName(optionValue)}</span>
      ) : (
        <span className="truncate">{optionValue}</span>
      )}
    </CommandItem>
  );
}
