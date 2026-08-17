import { cva } from "class-variance-authority";
import {
  ChevronDown,
  ChevronRight,
  CloudAlert,
  CloudCheck,
  MessageCircleMore,
  UploadCloud,
} from "lucide-react-native";
import React, { memo } from "react";
import { Pressable, Text, View } from "react-native";
import type { MeasurementStatus } from "~/features/recent-measurements/hooks/use-all-measurements";
import { useTranslation } from "~/shared/i18n";
import { AnswerData } from "~/shared/measurements/convert-cycle-answers-to-array";
import { formatTimeAgo } from "~/shared/time/format-time-ago";
import { cn } from "~/shared/ui/cn";
import { useTheme } from "~/shared/ui/hooks/use-theme";

interface SemanticColors {
  success: string;
  info: string;
  error: string;
}

const STATUS_ICON: Record<MeasurementStatus, (c: { semantic: SemanticColors }) => React.ReactNode> =
  {
    successful: (c) => <CloudCheck size={16} color={c.semantic.success} />,
    pending: (c) => <UploadCloud size={16} color={c.semantic.info} />,
    failed: (c) => <CloudAlert size={16} color={c.semantic.error} />,
  };

const answersTextStyle = cva("mb-1.5 text-base", {
  variants: {
    state: {
      true: "font-medium",
      false: "font-normal italic",
    },
  },
});

interface MeasurementRunItemProps {
  /** Run row id (`run:<workbookRunId>`), passed back by the toggle. */
  id: string;
  count: number;
  experimentName: string;
  /** Newest measurement in the run. */
  timestamp: string;
  /** Worst-of status across the run. */
  status: MeasurementStatus;
  questions?: AnswerData[];
  hasComment?: boolean;
  expanded: boolean;
  onToggle: (id: string) => void;
}

/**
 * Collapsed workbook run: one row standing in for every measurement the run
 * produced, expandable into them. Mirrors measurement-item's layout so an
 * expanded run reads as the same list, one level in.
 */
export const MeasurementRunItem = memo(function MeasurementRunItem({
  id,
  count,
  experimentName,
  timestamp,
  status,
  questions,
  hasComment = false,
  expanded,
  onToggle,
}: MeasurementRunItemProps) {
  const { colors } = useTheme();
  const { t } = useTranslation(["common", "recentMeasurements"]);
  const hasAnswers = questions && questions.length > 0;
  const answersText = hasAnswers ? questions.map((q) => q.question_answer).join(" | ") : null;
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <Pressable
      className={cn(
        "border-divider flex-row items-start border-t py-3 pl-1 pr-4",
        // Open runs sit on `surface` so the header reads as the lid of the
        // group rather than another measurement row.
        expanded ? "bg-jii-mint" : "bg-card",
      )}
      onPress={() => onToggle(id)}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={t(
        expanded ? "recentMeasurements:list.collapseRun" : "recentMeasurements:list.expandRun",
      )}
    >
      <View className="w-7 items-center pt-0.5">
        <Chevron size={18} color={colors.inactive} />
      </View>

      <View className="flex-1">
        {/* Top: answers, shared by every measurement in the run */}
        <Text
          className={cn(
            answersTextStyle({ state: hasAnswers }),
            hasAnswers ? "text-on-surface" : "text-muted-body",
          )}
          numberOfLines={1}
        >
          {hasAnswers ? answersText : t("recentMeasurements:list.noQuestionsAnswered")}
        </Text>

        {/* Bottom row: experiment name + run size on the left, time + status right */}
        <View className="flex-row items-center justify-between">
          <View className="mr-2 flex-1 flex-row items-center gap-1">
            <Text className="text-muted-body shrink text-sm font-normal" numberOfLines={1}>
              {experimentName}
            </Text>
            {hasComment && <MessageCircleMore size={14} color={colors.inactive} />}
          </View>

          <View className="flex-row items-center gap-1.5">
            {/* Inverse of the row tint, so the pill stays visible collapsed or
                expanded, in either scheme. */}
            <View className={cn("rounded-full px-2 py-0.5", expanded ? "bg-card" : "bg-surface")}>
              <Text className="text-muted-body text-[11px] font-bold">
                {t("recentMeasurements:list.runMeasurementCount", { count })}
              </Text>
            </View>
            <Text className="text-muted-body shrink-0 text-sm" numberOfLines={1}>
              {formatTimeAgo(timestamp)}
            </Text>
            {STATUS_ICON[status](colors)}
          </View>
        </View>
      </View>
    </Pressable>
  );
});
