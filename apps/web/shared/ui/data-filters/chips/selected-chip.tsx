"use client";

import { X } from "lucide-react";

import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

import { ContributorIdentity } from "../../contributor/contributor-identity";

export interface SelectedChipProps {
  chipKey: string;
  contributorJson: string | undefined;
  isContributor: boolean;
  onRemove: (key: string) => void;
}

export function SelectedChip({
  chipKey,
  contributorJson,
  isContributor,
  onRemove,
}: SelectedChipProps) {
  const { t } = useTranslation("common");
  return (
    <Badge variant="secondary" className="h-5 gap-1 pl-2 pr-1 text-[10px] font-normal">
      {isContributor && contributorJson ? (
        <ContributorIdentity data={contributorJson} size="compact" className="max-w-[16ch]" />
      ) : (
        <span className="max-w-[12ch] truncate">{chipKey}</span>
      )}
      <button
        type="button"
        className="hover:bg-muted-foreground/20 rounded-sm"
        onClick={() => onRemove(chipKey)}
        aria-label={t("dataFilters.removeValue", { name: chipKey })}
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
}
