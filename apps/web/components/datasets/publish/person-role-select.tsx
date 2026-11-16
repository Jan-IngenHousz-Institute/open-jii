"use client";

import { useTranslation } from "@repo/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import type { PersonRole } from "./use-dataset-people";

const ROLES: readonly PersonRole[] = ["author", "contributor", "neither"];

interface PersonRoleSelectProps {
  name: string;
  role: PersonRole;
  onChange: (role: PersonRole) => void;
}

/** Author, contributor or neither, the one choice Describe asks about every person. */
export function PersonRoleSelect({ name, role, onChange }: PersonRoleSelectProps) {
  const { t } = useTranslation("datasets");

  const handleChange = (value: string) => {
    const next = ROLES.find((option) => option === value);
    if (next !== undefined) {
      onChange(next);
    }
  };

  const renderRole = (option: PersonRole) => (
    <SelectItem key={option} value={option}>
      {t(`describe.roles.${option}`)}
    </SelectItem>
  );

  return (
    <Select value={role} onValueChange={handleChange}>
      <SelectTrigger className="w-32" aria-label={t("describe.roleLabel", { name })}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{ROLES.map(renderRole)}</SelectContent>
    </Select>
  );
}
