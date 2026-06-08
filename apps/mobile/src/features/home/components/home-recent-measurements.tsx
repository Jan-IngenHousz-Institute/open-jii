import { useRouter } from "expo-router";
import { Activity, BookOpen, CloudAlert, CloudCheck, CloudUpload } from "lucide-react-native";
import React from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { useTopMeasurements } from "~/features/recent-measurements/hooks/use-all-measurements";
import type {
  MeasurementItem,
  MeasurementStatus,
} from "~/features/recent-measurements/hooks/use-all-measurements";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import { formatTimeAgo } from "~/shared/time/format-time-ago";
import { showAlert } from "~/shared/ui/AlertDialog";
import { Card } from "~/shared/ui/Card";
import { RowItem } from "~/shared/ui/RowItem";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

const DOCS_URL = "https://docs.openjii.org/docs/introduction/overview";

function StatusIcon({ status }: { status: MeasurementStatus }) {
  switch (status) {
    case "successful":
      return <CloudCheck size={18} color={colors.semantic.success} />;
    case "pending":
      return <CloudUpload size={18} color={colors.semantic.info} />;
    case "failed":
      return <CloudAlert size={18} color={colors.semantic.error} />;
    default:
      return "";
  }
}

export function HomeRecentMeasurements() {
  const router = useRouter();
  const { t } = useTranslation(["home", "common"]);
  const themeColors = useThemeColors();
  const { measurements: top } = useTopMeasurements(3);
  const isEmpty = top.length === 0;

  // Mirror profile-account-card's safe external-open (same docs URL): confirm a
  // handler exists and surface a fallback instead of a silently rejected promise.
  const handleOpenDocs = async () => {
    try {
      if (await Linking.canOpenURL(DOCS_URL)) {
        await Linking.openURL(DOCS_URL);
        return;
      }
    } catch {
      // fall through to the alert
    }
    showAlert(t("common:errorTitle"), t("home:recent.docsUnavailable"));
  };

  return (
    <View className="mt-4">
      <View className="mb-2 flex-row items-baseline justify-between px-4">
        <Text className="text-on-surface" style={{ fontFamily: "Poppins-Bold", fontSize: 16 }}>
          {t("recent.sectionTitle")}
        </Text>
        {!isEmpty && (
          <Pressable onPress={() => router.push("/(tabs)/recent-measurements")} hitSlop={8}>
            <Text className="text-primary text-[14px] font-bold">{t("recent.seeAll")}</Text>
          </Pressable>
        )}
      </View>

      {isEmpty ? (
        <Card tone="white" padded>
          <Text className="text-muted-body text-center text-[13px]">{t("recent.emptyHint")}</Text>
          <Pressable
            onPress={() => void handleOpenDocs()}
            className="mt-3 flex-row items-center justify-center gap-1.5"
            hitSlop={8}
          >
            <BookOpen size={16} color={themeColors.brand} />
            <Text className="text-primary text-[13px] font-bold">{t("recent.emptyCtaDocs")}</Text>
          </Pressable>
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
  const nodeCount = item.questions?.length ?? 0;
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
