import React from "react";
import { useTranslation } from "~/shared/i18n";
import { Tag } from "~/shared/ui/Tag";

import type { ExperimentMembershipStatus } from "@repo/api/domains/experiment/experiment.schema";

interface ExperimentMembershipTagProps {
  membershipStatus: ExperimentMembershipStatus;
}

export function ExperimentMembershipTag({ membershipStatus }: ExperimentMembershipTagProps) {
  const { t } = useTranslation("experiments");

  if (membershipStatus === "member") {
    return <Tag variant="sensor">{t("membership.joined")}</Tag>;
  }

  if (membershipStatus === "pending_request") {
    return <Tag variant="queued">{t("membership.requested")}</Tag>;
  }

  return null;
}
