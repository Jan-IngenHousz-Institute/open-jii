"use client";

import { UserAvatar } from "@/components/user-avatar";

import type { OutsideCollaborator } from "@repo/api/domains/organization/organization.schema";
import { useTranslation } from "@repo/i18n";

/**
 * People who hold a grant on one of the organization's resources without being a
 * member of it. Read-only on purpose: the access lives on each resource, so this
 * is a place to notice it, not a place to change it — the resource's own
 * collaborators surface is where a grant is revoked.
 *
 * Absent rather than empty when there are none: an organization whose access is
 * entirely internal has nothing to say here.
 */
export function OrganizationOutsideCollaborators({
  collaborators,
}: {
  collaborators: OutsideCollaborator[];
}) {
  const { t } = useTranslation();

  if (collaborators.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="space-y-1">
        <h3 className="text-sm font-medium">{t("organizations.outsideCollaborators.title")}</h3>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {t("organizations.outsideCollaborators.description")}
        </p>
      </div>

      <div
        role="list"
        className="border-border divide-border divide-y overflow-hidden rounded-lg border"
      >
        {collaborators.map((collaborator) => (
          <div
            role="listitem"
            key={collaborator.userId}
            className="flex items-center gap-3 px-4 py-3"
          >
            <UserAvatar
              avatarUrl={collaborator.avatarUrl}
              firstName={collaborator.firstName}
              lastName={collaborator.lastName}
              className="h-9 w-9"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {`${collaborator.firstName} ${collaborator.lastName}`.trim() ||
                  (collaborator.email ?? collaborator.userId)}
              </p>
              <p className="text-muted-foreground truncate text-xs">{collaborator.email}</p>
            </div>
            <span className="text-muted-foreground shrink-0 text-xs">
              {t("organizations.outsideCollaborators.resourceCount", {
                count: collaborator.resourceCount,
              })}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
