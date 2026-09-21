import React from "react";
import { Text } from "react-native";
import { uploadFailureCategory } from "~/features/recent-measurements/utils/upload-failure-category";
import type { UploadFailureCategory } from "~/features/recent-measurements/utils/upload-failure-category";
import { useTranslation } from "~/shared/i18n";

interface Props {
  /** The kind stored on the row when it failed. */
  reason: string | null;
}

const MESSAGE_KEY: Readonly<Record<UploadFailureCategory, string>> = {
  connection: "recentMeasurements:failureReason.connection",
  credentials: "recentMeasurements:failureReason.credentials",
  permission: "recentMeasurements:failureReason.permission",
  rejected: "recentMeasurements:failureReason.rejected",
  unknown: "recentMeasurements:failureReason.unknown",
};

export function UploadFailureNote({ reason }: Props) {
  const { t } = useTranslation("recentMeasurements");

  return (
    <Text className="text-error mt-0.5 text-xs" numberOfLines={2}>
      {t(MESSAGE_KEY[uploadFailureCategory(reason)])}
    </Text>
  );
}
