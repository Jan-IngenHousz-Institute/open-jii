import React from "react";
import { View } from "react-native";
import { useTranslation } from "~/shared/i18n";
import { Tag } from "~/shared/ui/Tag";

import type {
  OrganizationMembershipStatus,
  OrganizationVisibility,
} from "@repo/api/domains/organization/organization.schema";

interface OrganizationMembershipTagsProps {
  visibility: OrganizationVisibility;
  membershipStatus: OrganizationMembershipStatus;
  showMemberTag?: boolean;
}

export function OrganizationMembershipTags({
  visibility,
  membershipStatus,
  showMemberTag = true,
}: OrganizationMembershipTagsProps) {
  const { t } = useTranslation("organizations");

  const isPrivate = visibility === "private";
  const isMember = membershipStatus === "member" && showMemberTag;
  const isPending = membershipStatus === "pending_request";
  if (!isPrivate && !isMember && !isPending) return null;

  return (
    <View className="flex-row items-center gap-1.5">
      {isPrivate ? <Tag>{t("membership.private")}</Tag> : null}
      {isMember ? <Tag variant="sensor">{t("membership.member")}</Tag> : null}
      {isPending ? <Tag variant="queued">{t("membership.requested")}</Tag> : null}
    </View>
  );
}
