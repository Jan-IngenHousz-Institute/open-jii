import { useRouter } from "expo-router";
import { Activity, CloudAlert, CloudCheck, CloudUpload } from "lucide-react-native";
import React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useAllMeasurements } from "~/features/recent-measurements/hooks/use-all-measurements";
import type {
  MeasurementItem,
  MeasurementStatus,
} from "~/features/recent-measurements/hooks/use-all-measurements";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import { Card } from "~/shared/ui/Card";
import { RowItem } from "~/shared/ui/RowItem";
import { formatTimeAgo } from "~/shared/utils/format-time-ago";

function StatusIcon({ status }: { status: MeasurementStatus }) {
  switch (status) {
    case "successful":
      return <CloudCheck size={18} color={colors.semantic.success} />;
    case "uploading":
      return <ActivityIndicator size={16} color={colors.semantic.info} />;
    case "pending":
      return <CloudUpload size={18} color={colors.semantic.info} />;
    case "failed":
      return <CloudAlert size={18} color={colors.semantic.error} />;
  }
}

export function HomeRecentMeasurements() {
  const router = useRouter();
  const { t } = useTranslation("home");
  const { measurements } = useAllMeasurements("all");

  const top = measurements.slice(0, 3);

  return (
    <View className="mt-4">
      <View className="mb-2 flex-row items-baseline justify-between px-4">
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
}

function HomeRecentRow({ item, isLast, onPress }: HomeRecentRowProps) {
  const { t } = useTranslation("home");
  const nodeCount = item.questions.length;
  const subtitle = `${formatTimeAgo(item.timestamp)} · ${t("recent.metaCountNodes", { count: nodeCount })}`;

  return (
    <RowItem
      icon={<Activity size={18} color={colors.jii.darkGreen} />}
      iconBackgroundClassName="bg-jii-mint"
      title={item.experimentName}
      subtitle={subtitle}
      onPress={onPress}
      right={<StatusIcon status={item.status} />}
      isLast={isLast}
    />
  );
}
