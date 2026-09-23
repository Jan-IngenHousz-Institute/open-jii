import { ChevronRight, FlaskConical } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import { Avatar } from "~/shared/ui/Avatar";
import { Card } from "~/shared/ui/Card";
import { Tag } from "~/shared/ui/Tag";
import { experimentStatusLabelKey } from "~/shared/ui/experiment-status-label";
import { useThemeColors } from "~/shared/ui/hooks/use-theme-colors";

import type { ExperimentListItem } from "@repo/api/domains/experiment/experiment.schema";

interface DiscoverExperimentRowProps {
  experiment: ExperimentListItem;
  onPress: (id: string) => void;
}

export function DiscoverExperimentRow({ experiment, onPress }: DiscoverExperimentRowProps) {
  const themeColors = useThemeColors();
  const { t } = useTranslation(["discover", "experiments"]);

  const statusKey = experimentStatusLabelKey(experiment.status);
  const meta = [
    experiment.organizationName,
    typeof experiment.membersCount === "number"
      ? t("discover:collaborators", { count: experiment.membersCount })
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      onPress={() => onPress(experiment.id)}
      accessibilityRole="button"
      className="active:opacity-60"
    >
      <Card padded style={{ marginVertical: 0, marginTop: 10, padding: 12 }}>
        <View className="flex-row items-center gap-3">
          <Avatar size={44} icon={<FlaskConical size={20} color={colors.jii.darkGreen} />} />
          <View className="min-w-0 flex-1">
            <View className="flex-row items-center gap-2">
              <Text
                className="text-on-surface font-poppins-bold min-w-0 shrink text-[15px] leading-[19px]"
                numberOfLines={1}
              >
                {experiment.name}
              </Text>
              {experiment.membershipStatus === "member" ? (
                <Tag variant="sensor">{t("experiments:membership.joined")}</Tag>
              ) : null}
              {experiment.membershipStatus === "pending_request" ? (
                <Tag variant="queued">{t("experiments:membership.requested")}</Tag>
              ) : null}
              {statusKey ? <Tag>{t(statusKey)}</Tag> : null}
            </View>
            {meta ? (
              <Text className="text-muted-body mt-0.5 text-[12.5px]" numberOfLines={1}>
                {meta}
              </Text>
            ) : null}
          </View>
          <ChevronRight size={18} color={themeColors.inactive} />
        </View>
      </Card>
    </Pressable>
  );
}
