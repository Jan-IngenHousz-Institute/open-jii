"use client";

import { useTranslation } from "@repo/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

import type { ShareableRole } from "./collaborator-roles";
import { SHAREABLE_ROLES, shareableRoleLabelKey } from "./collaborator-roles";

interface RoleSelectProps {
  /** Already collapsed to the two UI roles — see `collapseRole`. */
  value: ShareableRole;
  onChange: (role: ShareableRole) => void;
  disabled?: boolean;
  /** Accessible name; required because the select carries no visible label. */
  ariaLabel: string;
  className?: string;
}

/** "Can edit" / "Can view" select shared by the grantee picker and each row. */
export function RoleSelect({
  value,
  onChange,
  disabled = false,
  ariaLabel,
  className,
}: RoleSelectProps) {
  const { t } = useTranslation();

  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as ShareableRole)}
      disabled={disabled}
    >
      <SelectTrigger className={className ?? "w-[130px]"} aria-label={ariaLabel}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SHAREABLE_ROLES.map((role) => (
          <SelectItem key={role} value={role}>
            {t(shareableRoleLabelKey(role))}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
