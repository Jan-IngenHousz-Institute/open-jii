"use client";

import { UserAvatar } from "@/components/user-avatar";
import { X } from "lucide-react";

import type { ContributorType, DatasetContributor } from "@repo/api/domains/dataset/dataset.schema";
import { zContributorType } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

interface DatasetContributorRowProps {
  position: number;
  contributor: DatasetContributor;
  onTypeChange: (position: number, type: ContributorType) => void;
  onRemove: (position: number) => void;
}

export function DatasetContributorRow({
  position,
  contributor,
  onTypeChange,
  onRemove,
}: DatasetContributorRowProps) {
  const { t } = useTranslation("datasets");

  const name = `${contributor.givenName} ${contributor.familyName}`;
  const hasOrcid = contributor.orcid !== null;

  const handleTypeChange = (value: string) => onTypeChange(position, zContributorType.parse(value));
  const handleRemove = () => onRemove(position);

  const renderType = (type: ContributorType) => (
    <SelectItem key={type} value={type}>
      {t(`describe.contributorTypes.${type}`)}
    </SelectItem>
  );

  return (
    <li className="flex items-center gap-3 py-2.5">
      <UserAvatar
        firstName={contributor.givenName}
        lastName={contributor.familyName}
        className="size-8 text-xs"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
          {hasOrcid ? (
            <>
              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                {t("describe.orcidMark")}
              </Badge>
              {contributor.orcid}
            </>
          ) : (
            t("describe.noOrcid")
          )}
        </p>
      </div>

      <Select value={contributor.contributorType} onValueChange={handleTypeChange}>
        <SelectTrigger className="w-44" aria-label={t("describe.contributorType", { name })}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{zContributorType.options.map(renderType)}</SelectContent>
      </Select>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleRemove}
        className="text-muted-foreground hover:text-destructive"
        aria-label={t("describe.remove", { name })}
      >
        <X className="size-4" />
      </Button>
    </li>
  );
}
