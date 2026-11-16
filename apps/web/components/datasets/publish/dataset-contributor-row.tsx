"use client";

import type { ContributorType, DatasetContributor } from "@repo/api/domains/dataset/dataset.schema";
import { zContributorType } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import { DatasetPersonIdentity } from "./dataset-person-identity";
import { PersonRoleSelect } from "./person-role-select";
import type { PersonRole } from "./use-dataset-people";
import { personKey } from "./use-dataset-people";

interface DatasetContributorRowProps {
  position: number;
  contributor: DatasetContributor;
  onTypeChange: (position: number, type: ContributorType) => void;
  onRoleChange: (key: string, role: PersonRole) => void;
}

export function DatasetContributorRow({
  position,
  contributor,
  onTypeChange,
  onRoleChange,
}: DatasetContributorRowProps) {
  const { t } = useTranslation("datasets");

  const name = `${contributor.givenName} ${contributor.familyName}`;

  const handleTypeChange = (value: string) => onTypeChange(position, zContributorType.parse(value));
  const handleRoleChange = (role: PersonRole) => onRoleChange(personKey(contributor), role);

  const renderType = (type: ContributorType) => (
    <SelectItem key={type} value={type}>
      {t(`describe.contributorTypes.${type}`)}
    </SelectItem>
  );

  return (
    <li className="flex items-center gap-3 py-2.5">
      <DatasetPersonIdentity {...contributor} affiliation={null} />

      <Select value={contributor.contributorType} onValueChange={handleTypeChange}>
        <SelectTrigger className="w-40" aria-label={t("describe.contributorType", { name })}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>{zContributorType.options.map(renderType)}</SelectContent>
      </Select>

      <PersonRoleSelect name={name} role="contributor" onChange={handleRoleChange} />
    </li>
  );
}
