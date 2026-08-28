"use client";

import { InsetPanel } from "@/components/shared/inset-panel";
import { Building2, ExternalLink } from "lucide-react";

import type { DeletionBlockerOrganization } from "@repo/api/domains/user/user.schema";
import { useTranslation } from "@repo/i18n";

interface DeleteAccountOrganizationBlockersProps {
  organizations: DeletionBlockerOrganization[];
  locale: string;
  hasResourceBlockers?: boolean;
}

/**
 * The organizations the user is the last owner of. Nothing here can be cleared from the
 * dialog — promoting an owner and deleting the organization both live on its own pages —
 * so each row is a link there rather than a picker.
 *
 * Deliberately the first thing in the dialog body. A resource is blocked when nobody
 * else can administer it, and being its owning organization's only owner is one of the
 * two ways that happens — so promoting a second owner here clears this section *and*
 * every resource row that this organization owns. Presenting the two as independent work
 * is what made people do it twice.
 */
export function DeleteAccountOrganizationBlockers({
  organizations,
  locale,
  hasResourceBlockers = false,
}: DeleteAccountOrganizationBlockersProps) {
  const { t } = useTranslation("account");

  return (
    <InsetPanel tone="destructive" className="flex shrink-0 flex-col gap-3 text-sm">
      <div className="flex items-start gap-3">
        <div className="bg-destructive/10 text-destructive flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
          <Building2 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-destructive font-medium">
            {t("dangerZone.delete.organizationBlockers.title")}
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            {t("dangerZone.delete.organizationBlockers.description")}
          </p>
          {hasResourceBlockers && (
            <p className="text-foreground text-xs font-medium leading-relaxed">
              {t("dangerZone.delete.organizationBlockers.alsoClearsResources")}
            </p>
          )}
        </div>
      </div>

      <ul className="space-y-2">
        {organizations.map((organization) => (
          <li
            key={organization.id}
            className="border-border bg-background flex items-center justify-between gap-2 rounded-md border p-3 shadow-sm"
          >
            <span className="min-w-0 truncate font-medium">{organization.name}</span>
            <a
              href={`/${locale}/platform/organizations/${organization.id}/members`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-7 min-w-0 max-w-[46%] shrink-0 items-center gap-1 rounded-md px-2 text-xs transition-colors sm:max-w-none"
            >
              <span className="truncate">
                {t("dangerZone.delete.organizationBlockers.manageLink")}
              </span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </li>
        ))}
      </ul>
    </InsetPanel>
  );
}
