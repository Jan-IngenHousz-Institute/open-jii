"use client";

import { useTranslation } from "@repo/i18n";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

export const ATTRIBUTE_ROLES = ["factor", "studiedMaterial", "grouping", "none"] as const;

export type AttributeRole = (typeof ATTRIBUTE_ROLES)[number];

interface LayoutAttributeRoleSelectProps {
  name: string;
  role: AttributeRole;
  canEdit: boolean;
  onChange: (name: string, role: AttributeRole) => void;
}

/** One plot attribute and the role standards read it in, as text for people who cannot edit. */
export function LayoutAttributeRoleSelect({
  name,
  role,
  canEdit,
  onChange,
}: LayoutAttributeRoleSelectProps) {
  const { t } = useTranslation("experiments");
  const id = `attribute-role-${name}`;

  const handleChange = (value: string) => {
    const chosen = ATTRIBUTE_ROLES.find((candidate) => candidate === value);
    if (chosen !== undefined) {
      onChange(name, chosen);
    }
  };

  const renderOption = (option: AttributeRole) => (
    <SelectItem key={option} value={option}>
      {t(`layout.roles.${option}`)}
    </SelectItem>
  );

  return (
    <div className="flex items-center justify-between gap-3" data-attribute-role={name}>
      <Label htmlFor={id} className="text-sm font-normal">
        {name}
      </Label>
      {canEdit ? (
        <Select value={role} onValueChange={handleChange}>
          <SelectTrigger id={id} className="w-44" aria-label={t("layout.roles.label", { name })}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>{ATTRIBUTE_ROLES.map(renderOption)}</SelectContent>
        </Select>
      ) : (
        <span className="text-muted-foreground text-sm">{t(`layout.roles.${role}`)}</span>
      )}
    </div>
  );
}
