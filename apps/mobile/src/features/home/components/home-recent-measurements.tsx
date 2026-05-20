import { useRouter } from "expo-router";
import { Activity } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useTopMeasurements } from "~/features/recent-measurements/hooks/use-all-measurements";
import type {
  MeasurementItem,
  MeasurementStatus,
} from "~/features/recent-measurements/hooks/use-all-measurements";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import { Card } from "~/shared/ui/Card";
import { RowItem } from "~/shared/ui/RowItem";
import { Tag } from "~/shared/ui/Tag";
import type { TagVariant } from "~/shared/ui/Tag";
import { formatTimeAgo } from "~/shared/utils/format-time-ago";

const STATUS_VARIANT: Record<MeasurementStatus, TagVariant> = {
  successful: "synced",
  pending: "queued",
  failed: "failed",
};

function statusLabel(t: (k: string) => string, status: MeasurementStatus): string {
  switch (status) {
    case "successful":
      return t("recent.tagSynced");
    case "pending":
      return t("recent.tagQueued");
    case "failed":
      return t("recent.tagFailed");
    default:
      return "";
  }
}

export function HomeRecentMeasurements() {
  const router = useRouter();
  const { t } = useTranslation("home");
  const { measurements: top } = useTopMeasurements(3);

  return (
    <View className="mt-4">
      <View className="mb-2 flex-row items-baseline justify-between px-1">
        <Text className="text-on-surface" style={{ fontFamily: "Poppins-Bold", fontSize: 16 }}>
          {t("recent.sectionTitle")}
        </Text>
        <Pressable onPress={() => router.push("/(tabs)/recent-measurements")} hitSlop={8}>
          <Text className="text-primary text-[14px] font-bold">{t("recent.seeAll")}</Text>
        </Pressable>
      </View>

      {top.length === 0 ? (
        <Card tone="white" padded>
          <Text className="text-muted-body text-center text-[13px]">{t("recent.emptyHint")}</Text>
        </Card>
      ) : (
        <Card tone="white" padded={false}>
          {top.map((item, index) => (
            <HomeRecentRow
              key={item.key}
              item={item}
              isLast={index === top.length - 1}
              onPress={() => router.push("/(tabs)/recent-measurements")}
              statusLabelText={statusLabel(t, item.status)}
            />
          ))}
        </Card>
      )}
    </View>
  );
}

interface HomeRecentRowProps {
  item: MeasurementItem;
  isLast: boolean;
  onPress: () => void;
  statusLabelText: string;
}

function HomeRecentRow({ item, isLast, onPress, statusLabelText }: HomeRecentRowProps) {
  const { t } = useTranslation("home");
  const nodeCount = item.questions?.length ?? 0;
  const subtitle = `${formatTimeAgo(item.timestamp)} · ${t("recent.metaCountNodes", { count: nodeCount })}`;

  return (
    <RowItem
      icon={<Activity size={18} color={colors.jii.darkGreen} />}
      iconBackgroundClassName="bg-jii-mint"
      title={item.experimentName}
      subtitle={subtitle}
      onPress={onPress}
      right={<Tag variant={STATUS_VARIANT[item.status]}>{statusLabelText}</Tag>}
      isLast={isLast}
    />
  );
}
