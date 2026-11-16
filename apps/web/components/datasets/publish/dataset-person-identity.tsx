"use client";

import { UserAvatar } from "@/components/user-avatar";

import type { AuthorRequest, PersonOrigin } from "@repo/api/domains/dataset/dataset.schema";
import { useTranslation } from "@repo/i18n";
import { Badge } from "@repo/ui/components/badge";

interface DatasetPersonIdentityProps {
  givenName: string;
  familyName: string;
  affiliation: string | null;
  orcid: string | null;
  email: string | null;
  /** Null for a member nobody has named yet, who has been sent nothing. */
  origin: PersonOrigin | null;
  request: AuthorRequest | null;
}

/** Who a person is and how far their request is, the same in every group of Describe. */
export function DatasetPersonIdentity({
  givenName,
  familyName,
  affiliation,
  orcid,
  email,
  origin,
  request,
}: DatasetPersonIdentityProps) {
  const { t } = useTranslation("datasets");

  const isInvitedByEmail = origin === "email";
  const isFromOrganization = origin === "organization";
  const isWaiting = request === "pending";
  const hasAccepted = request === "accepted";
  // Only someone with an account can connect ORCID, so an invitation by email never says it lacks one.
  const hasNoOrcid = !isInvitedByEmail && orcid === null;

  return (
    <>
      <UserAvatar firstName={givenName} lastName={familyName} className="size-8 text-xs" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">
            {givenName} {familyName}
          </p>
          {isInvitedByEmail ? (
            <Badge variant="secondary">{t("describe.invitedByEmail")}</Badge>
          ) : null}
          {isFromOrganization ? (
            <Badge variant="secondary">{t("describe.fromOrganization")}</Badge>
          ) : null}
          {isWaiting ? (
            <Badge className="bg-status-stale text-status-stale-foreground">
              {t("describe.requestPending")}
            </Badge>
          ) : null}
          {hasAccepted ? <Badge variant="outline">{t("describe.requestAccepted")}</Badge> : null}
        </div>
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 text-xs">
          {email !== null ? <span>{email}</span> : null}
          {affiliation !== null ? <span>{affiliation}</span> : null}
          {orcid !== null ? (
            <a
              href={`https://orcid.org/${orcid}`}
              target="_blank"
              rel="noreferrer"
              aria-label={t("describe.orcidLabel", { orcid })}
              className="hover:text-foreground inline-flex items-center gap-1"
            >
              <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                {t("describe.orcidMark")}
              </Badge>
              {orcid}
            </a>
          ) : null}
          {hasNoOrcid ? <span>{t("describe.noOrcid")}</span> : null}
        </div>
      </div>
    </>
  );
}
