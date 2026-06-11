"use client";

import { Check } from "lucide-react";
import { ContributorIdentity } from "~/components/contributor/contributor-identity";

import { CommandItem } from "@repo/ui/components/command";
import { cn } from "@repo/ui/lib/utils";

export interface CategoricalOptionProps {
  optionValue: string;
  isSelected: boolean;
  isContributor: boolean;
  onSelect: () => void;
}

export function CategoricalOption({
  optionValue,
  isSelected,
  isContributor,
  onSelect,
}: CategoricalOptionProps) {
  return (
    <CommandItem value={optionValue} onSelect={onSelect}>
      <Check className={cn("mr-2 h-4 w-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
      {isContributor ? (
        <ContributorIdentity data={optionValue} size="compact" />
      ) : (
        <span className="truncate">{optionValue}</span>
      )}
    </CommandItem>
  );
}
