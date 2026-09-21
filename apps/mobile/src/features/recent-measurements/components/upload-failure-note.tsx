import React from "react";
import { Text } from "react-native";
import { uploadFailureMessageKey } from "~/features/recent-measurements/utils/upload-failure-category";
import { useTranslation } from "~/shared/i18n";

interface Props {
  /** The kind stored on the row when it failed. */
  reason: string | null;
}

export function UploadFailureNote({ reason }: Props) {
  const { t } = useTranslation("recentMeasurements");

  return (
    <Text className="text-error mt-0.5 text-xs" numberOfLines={2}>
      {t(uploadFailureMessageKey(reason))}
    </Text>
  );
}
