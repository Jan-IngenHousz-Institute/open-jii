"use client";

import { useLocale } from "@/hooks/useLocale";
import Link from "next/link";

import { useTranslation } from "@repo/i18n";
import { cn } from "@repo/ui/lib/utils";

import { organizationPath } from "./organization-routes";

interface OwningOrganizationValueProps {
  organizationId: string | null | undefined;
  /**
   * The organization's display name as the detail read returns it — `null` for a
   * personal workspace, which the server collapses so no client has to know the
   * slug rule.
   */
  organizationName: string | null | undefined;
  className?: string;
}

/**
 * Who owns a resource, rendered wherever its detail surface already shows who
 * created it — the two answer different questions, and until now only the second was
 * on the page: nothing said which organization's members can reach it.
 *
 * A real organization links to its page; a personal workspace reads "Personal" and
 * links nowhere, because it has no page — it is excluded from the whole organization
 * surface by design.
 */
export function OwningOrganizationValue({
  organizationId,
  organizationName,
  className,
}: OwningOrganizationValueProps) {
  const { t } = useTranslation();
  const locale = useLocale();

  if (!organizationId || !organizationName) {
    return <span className={className}>{t("organizations.picker.personal")}</span>;
  }

  return (
    <Link
      href={organizationPath(locale, organizationId)}
      className={cn("underline underline-offset-2", className)}
    >
      {organizationName}
    </Link>
  );
}
