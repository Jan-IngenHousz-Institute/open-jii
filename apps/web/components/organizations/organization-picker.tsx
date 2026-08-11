"use client";

import { useMyOrganizations } from "@/hooks/organization/useMyOrganizations/useMyOrganizations";

import { useTranslation } from "@repo/i18n";
import { Label } from "@repo/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";

interface OrganizationPickerProps {
  /** `undefined` means the default target — the caller's personal workspace. */
  value: string | undefined;
  onChange: (organizationId: string | undefined) => void;
  disabled?: boolean;
  /** Field id, so a host form can label it in its own layout. */
  id?: string;
  className?: string;
}

/**
 * Which organization a new resource belongs to. The default is the personal
 * workspace — the same default the backend applies when the field is omitted — so
 * creating something without thinking about organizations behaves as it always did.
 *
 * Renders nothing when the caller belongs to no organization beyond their own
 * workspace: a picker with a single unchangeable option is a decision presented
 * where none exists. The membership check still happens server-side on create.
 */
export function OrganizationPicker({
  value,
  onChange,
  disabled = false,
  id = "resource-organization",
  className,
}: OrganizationPickerProps) {
  const { t } = useTranslation();
  const { data } = useMyOrganizations();

  const organizations = data ?? [];
  const personal = organizations.find((organization) => organization.isPersonal);
  const shared = organizations.filter((organization) => !organization.isPersonal);

  if (shared.length === 0) return null;

  return (
    <div className={className ?? "space-y-1.5"}>
      <Label htmlFor={id}>{t("organizations.picker.label")}</Label>
      <Select value={value ?? personal?.id ?? ""} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} aria-label={t("organizations.picker.label")}>
          <SelectValue placeholder={t("organizations.picker.personal")} />
        </SelectTrigger>
        <SelectContent>
          {personal ? (
            <SelectItem value={personal.id}>{t("organizations.picker.personal")}</SelectItem>
          ) : null}
          {shared.map((organization) => (
            <SelectItem key={organization.id} value={organization.id}>
              {organization.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-muted-foreground text-xs">{t("organizations.picker.hint")}</p>
    </div>
  );
}
