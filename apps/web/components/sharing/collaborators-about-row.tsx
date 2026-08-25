"use client";

import type { AvatarTrailFace } from "@/components/organizations/organization-avatar-trail";
import { OrganizationAvatarTrail } from "@/components/organizations/organization-avatar-trail";
import { useResourceCollaborators } from "@/hooks/sharing/useResourceCollaborators/useResourceCollaborators";

import type {
  ResourceCollaboratorDto,
  SharingResourceType,
} from "@repo/api/domains/sharing/sharing.schema";
import { isGranteeRow } from "@repo/api/domains/sharing/sharing.schema";
import { useTranslation } from "@repo/i18n";

interface CollaboratorsAboutRowProps {
  resourceType: SharingResourceType;
  resourceId: string;
  /** The resource's Collaborators tab, where the faces lead. */
  href: string;
  /** Grant reads are share-gated; pass the caller's capability so a viewer
   * without it never fires a request guaranteed to 403. */
  enabled: boolean;
}

/**
 * The people with access, as one About-card row: an avatar trail plus a count
 * in words, the organization card's members grammar applied to any shareable
 * resource. Absent rather than empty when the viewer cannot read grants or
 * nobody holds one.
 */
export function CollaboratorsAboutRow({
  resourceType,
  resourceId,
  href,
  enabled,
}: CollaboratorsAboutRowProps) {
  const { t } = useTranslation();
  const { data, isPending, isError } = useResourceCollaborators(resourceType, resourceId, {
    enabled,
  });

  if (!enabled || isError || isPending) {
    return null;
  }

  const faces = data.filter(isGranteeRow).map(granteeAsFace);
  if (faces.length === 0) {
    return null;
  }

  return (
    <div>
      <dt className="text-muted-foreground text-xs">{t("sharing.cardTitle")}</dt>
      <dd className="mt-0.5">
        <OrganizationAvatarTrail
          faces={faces}
          href={href}
          label={t("sharing.collaboratorCount", { count: faces.length })}
        />
      </dd>
    </div>
  );
}

/** A grantee as a trail face; the display name splits like a person's name. */
function granteeAsFace(
  row: Extract<ResourceCollaboratorDto, { kind: "owner" | "grant" }>,
): AvatarTrailFace {
  const name = row.grantee.displayName ?? row.grantee.email ?? row.granteeId;
  const [firstWord = "", ...rest] = name.trim().split(/\s+/u);
  return {
    id: row.granteeId,
    firstName: firstWord,
    lastName: rest.join(" "),
    avatarUrl: row.grantee.avatarUrl,
  };
}
