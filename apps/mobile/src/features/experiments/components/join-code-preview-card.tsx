import { FlaskConical } from "lucide-react-native";
import { DateTime } from "luxon";
import React from "react";
import { Text, View } from "react-native";
import { ExperimentMembershipTag } from "~/features/experiments/components/experiment-membership-tag";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import { luxonLocale } from "~/shared/i18n/luxon-locale";
import { Avatar } from "~/shared/ui/Avatar";
import { Button } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import { extractTextFromHTML } from "~/shared/utils/extract-text-from-html";

import type { JoinCodePreview } from "@repo/api/domains/experiment/join-codes/experiment-join-codes.schema";
import { formatJoinCode } from "@repo/api/domains/experiment/join-codes/experiment-join-codes.schema";

export const DETAIL_ROW_CLASS =
  "border-divider mt-3 flex-row items-center justify-between border-t pt-2.5";

interface JoinCodePreviewCardProps {
  code: string;
  preview: JoinCodePreview;
  onJoin: () => void;
  onOpen: () => void;
  isJoining: boolean;
  isOffline: boolean;
}

export function JoinCodePreviewCard({
  code,
  preview,
  onJoin,
  onOpen,
  isJoining,
  isOffline,
}: JoinCodePreviewCardProps) {
  const { t, i18n } = useTranslation(["common", "experiments"]);

  const { experiment, membershipStatus, expiresAt } = preview;
  const isMember = membershipStatus === "member";

  const expiry = expiresAt
    ? DateTime.fromISO(expiresAt).setLocale(luxonLocale(i18n.language))
    : undefined;
  const validity =
    expiry?.isValid === true ? expiry.toFormat("d LLL yyyy") : t("experiments:joinCode.noExpiry");

  // Authored in web's rich-text editor, so it arrives as HTML.
  const description = experiment.description
    ? extractTextFromHTML(experiment.description).trim()
    : "";

  return (
    <Card padded>
      <View className="flex-row items-center gap-3">
        <Avatar size={56} icon={<FlaskConical size={24} color={colors.jii.darkGreen} />} />
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-2">
            <Text
              className="text-on-surface font-poppins-bold min-w-0 shrink text-[17px] leading-[22px]"
              numberOfLines={2}
            >
              {experiment.name}
            </Text>
            <View className="shrink-0">
              <ExperimentMembershipTag membershipStatus={membershipStatus} />
            </View>
          </View>
          {experiment.organizationName ? (
            <Text className="text-muted-body mt-0.5 text-[12.5px]">
              {experiment.organizationName}
            </Text>
          ) : null}
        </View>
      </View>

      {description.length > 0 ? (
        <Text className="text-on-surface mt-3 text-[13px] leading-5">{description}</Text>
      ) : null}

      <View className={DETAIL_ROW_CLASS}>
        <Text className="text-muted-body text-[13px]">{t("experiments:joinCode.codeLabel")}</Text>
        <Text className="text-on-surface font-overpass-bold text-[14px] tracking-[2px]">
          {formatJoinCode(code)}
        </Text>
      </View>

      <View className={DETAIL_ROW_CLASS}>
        <Text className="text-muted-body text-[13px]">{t("experiments:joinCode.validUntil")}</Text>
        <Text className="text-on-surface text-[13px]">{validity}</Text>
      </View>

      <View className={DETAIL_ROW_CLASS}>
        <Text className="text-muted-body text-[13px]">{t("experiments:joinCode.accessLevel")}</Text>
        <Text className="text-on-surface text-[13px]">
          {t("experiments:joinCode.accessLevelValue")}
        </Text>
      </View>

      <View className="mt-4 gap-2">
        {isMember ? (
          <Button title={t("experiments:joinCode.openExperiment")} onPress={onOpen} size="lg" />
        ) : (
          <>
            <Button
              title={isJoining ? t("experiments:joinCode.joining") : t("experiments:joinCode.join")}
              onPress={onJoin}
              isLoading={isJoining}
              isDisabled={isJoining || isOffline}
              size="lg"
            />
            {isOffline ? (
              <Text className="text-muted-body text-center text-[12px]">
                {t("experiments:joinCode.offlineHint")}
              </Text>
            ) : null}
          </>
        )}
        {experiment.hasWorkbook ? null : (
          <Text className="text-muted-body text-center text-[12px] leading-5">
            {t("experiments:joinCode.noWorkbookHint")}
          </Text>
        )}
      </View>
    </Card>
  );
}
