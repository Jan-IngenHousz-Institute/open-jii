import { cva } from "class-variance-authority";
import { FlaskConical, MessageSquare } from "lucide-react-native";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { colors } from "~/shared/constants/colors";
import { useTranslation } from "~/shared/i18n";
import { Card } from "~/shared/ui/Card";
import { Tag } from "~/shared/ui/Tag";
import type { TagVariant } from "~/shared/ui/Tag";

export interface ExperimentCardProps {
  id: string;
  title: string;
  description?: string;
  selected: boolean;
  onPress: (id: string) => void;
  requiresSensor: boolean;
  questionsOnly: boolean;
  nodeCount: number;
  durationMin: number;
  recentCount?: number;
}

const cardSelection = cva("border-2", {
  variants: {
    selected: {
      true: "border-primary",
      false: "border-transparent",
    },
  },
});

function pickTag(
  requiresSensor: boolean,
  questionsOnly: boolean,
): { variant: TagVariant; key: "sensorRequired" | "questionsOnly" | "sensorAndQuestions" } | null {
  if (questionsOnly) return { variant: "questions", key: "questionsOnly" };
  if (requiresSensor) {
    // "both" when there are also non-measurement nodes (questions/instructions).
    // The meta hook doesn't separate those, so map a sensor-required flow with
    // any non-measurement node into "sensor + questions". We can't tell that
    // here without the node list, so we default to "Sensor required" — the
    // distinction is rare in practice and the wording reads fine for both.
    return { variant: "sensor", key: "sensorRequired" };
  }
  return null;
}

export function ExperimentCard({
  id,
  title,
  description,
  selected,
  onPress,
  requiresSensor,
  questionsOnly,
  nodeCount,
  durationMin,
  recentCount = 0,
}: ExperimentCardProps) {
  const { t } = useTranslation("measurementFlow");
  const tag = pickTag(requiresSensor, questionsOnly);

  return (
    <Pressable onPress={() => onPress(id)} accessibilityRole="button" className="active:opacity-60">
      <Card
        tone={selected ? "mint" : "white"}
        padded
        className={cardSelection({ selected })}
        style={{ marginVertical: 0, padding: 14 }}
      >
        <View className="flex-row items-start gap-3">
          <View
            className="h-11 w-11 items-center justify-center rounded-xl"
            style={{ backgroundColor: questionsOnly ? colors.badge.published : colors.jii.mint }}
          >
            {questionsOnly ? (
              <MessageSquare size={20} color={colors.jii.darkGreen} />
            ) : (
              <FlaskConical size={20} color={colors.jii.darkGreen} />
            )}
          </View>
          <View className="min-w-0 flex-1">
            <Text
              className="text-on-surface"
              style={{ fontFamily: "Poppins-Bold", fontSize: 15, lineHeight: 19 }}
              numberOfLines={2}
            >
              {title}
            </Text>
            {description ? (
              <Text className="text-muted-body mt-1 text-[12.5px]" numberOfLines={2}>
                {description}
              </Text>
            ) : null}
            <View className="mt-2 flex-row flex-wrap items-center gap-2">
              {recentCount > 0 ? (
                <Tag variant="synced">
                  {t("experimentSelection.recentThisWeek", { n: recentCount })}
                </Tag>
              ) : null}
              {tag ? (
                <Tag variant={tag.variant}>{t(`experimentSelection.tag.${tag.key}`)}</Tag>
              ) : null}
              {nodeCount > 0 ? (
                <Text className="text-muted-body text-[11.5px]">
                  {t("experimentSelection.meta.nodesAndDuration", {
                    nodes: nodeCount,
                    minutes: durationMin,
                  })}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}
