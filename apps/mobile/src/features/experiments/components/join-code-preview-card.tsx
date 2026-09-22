import { DateTime } from "luxon";
import React from "react";
import { Text, View } from "react-native";
import type { SupportedLocale } from "~/shared/i18n";
import { useTranslation } from "~/shared/i18n";
import { Button } from "~/shared/ui/Button";
import { Card } from "~/shared/ui/Card";
import { extractTextFromHTML } from "~/shared/utils/extract-text-from-html";

import type { JoinCodePreview } from "@repo/api/domains/experiment/join-codes/experiment-join-codes.schema";
import { formatJoinCode } from "@repo/api/domains/experiment/join-codes/experiment-join-codes.schema";

const LUXON_LOCALE: Record<SupportedLocale, string> = {
  "en-US": "en-GB",
  "nl-NL": "nl-NL",
};

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

  const luxonLocale = LUXON_LOCALE[i18n.language as SupportedLocale] ?? "en-GB";
  const expiry = expiresAt ? DateTime.fromISO(expiresAt).setLocale(luxonLocale) : undefined;
  const validity =
    expiry?.isValid === true
      ? t("experiments:joinCode.validUntil", { date: expiry.toFormat("d LLL yyyy") })
      : t("experiments:joinCode.noExpiry");

  // Authored in web's rich-text editor, so it arrives as HTML.
  const description = experiment.description
    ? extractTextFromHTML(experiment.description).trim()
    : "";

  return (
    <Card padded>
      <Text className="text-muted-body text-[12.5px]">
        {`${t("experiments:joinCode.codeLabel")} `}
        <Text className="text-on-surface" style={{ fontFamily: "Overpass-Bold", letterSpacing: 2 }}>
          {formatJoinCode(code)}
        </Text>
        {` · ${validity}`}
      </Text>

      <Text
        className="text-on-surface mt-2"
        style={{ fontFamily: "Poppins-Bold", fontSize: 17, lineHeight: 22 }}
      >
        {experiment.name}
      </Text>
      {experiment.organizationName ? (
        <Text className="text-muted-body mt-0.5 text-[12.5px]">{experiment.organizationName}</Text>
      ) : null}

      {description.length > 0 ? (
        <Text className="text-on-surface mt-3 text-[13px] leading-5">{description}</Text>
      ) : null}

      {isMember ? (
        <Text className="text-on-surface mt-3 text-[13px] leading-5">
          {t("experiments:joinCode.alreadyMember")}
        </Text>
      ) : (
        <Text className="text-muted-body mt-3 text-[13px] leading-5">
          {t("experiments:joinCode.canViewHint")}
        </Text>
      )}

      {experiment.hasWorkbook ? null : (
        <Text className="text-muted-body mt-2 text-[12.5px] leading-5">
          {t("experiments:joinCode.noWorkbookHint")}
        </Text>
      )}

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
      </View>
    </Card>
  );
}
