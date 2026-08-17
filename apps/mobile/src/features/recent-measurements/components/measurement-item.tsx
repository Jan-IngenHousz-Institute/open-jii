import { MessageCircleMore, Trash2, UploadCloud } from "lucide-react-native";
import React, { memo } from "react";
import { Pressable, Text, TouchableOpacity, View } from "react-native";
import {
  answersTextStyle,
  STATUS_ICON,
} from "~/features/recent-measurements/components/measurement-row-visuals";
import type { MeasurementStatus } from "~/features/recent-measurements/hooks/use-all-measurements";
import { useIsProcessing } from "~/features/recent-measurements/hooks/use-outbox-state";
import { useTranslation } from "~/shared/i18n";
import { AnswerData } from "~/shared/measurements/convert-cycle-answers-to-array";
import { formatTimeAgo } from "~/shared/time/format-time-ago";
import { cn } from "~/shared/ui/cn";
import { useTheme } from "~/shared/ui/hooks/use-theme";

interface MeasurementItemProps {
  id: string;
  timestamp: string;
  experimentName: string;
  status: MeasurementStatus;
  questions?: AnswerData[];
  onPress?: (id: string) => void;
  onSync?: (id: string) => void;
  onDelete?: (id: string) => void;
  /** When true, action buttons (sync/delete) are hidden - e.g. when used inside a swipeable row */
  hideActions?: boolean;
  /** When true, shows a comment indicator icon */
  hasComment?: boolean;
  /** When true, indents the row: it sits under an expanded workbook-run row */
  indented?: boolean;
}

export const MeasurementItem = memo(function MeasurementItem({
  id,
  timestamp,
  experimentName,
  status,
  questions,
  onPress,
  onSync,
  onDelete,
  hideActions = false,
  hasComment = false,
  indented = false,
}: MeasurementItemProps) {
  const { colors } = useTheme();
  const { t } = useTranslation(["common", "recentMeasurements"]);
  const isSynced = status === "successful";
  const isSyncing = useIsProcessing(id);
  const hasAnswers = questions && questions.length > 0;
  const answersText = hasAnswers ? questions.map((q) => q.question_answer).join(" | ") : null;

  return (
    <Pressable
      className={cn(
        "border-divider border-t py-3 pr-4",
        // Nested rows carry a lighter shade of the open run's tint, so the
        // whole run reads as one block.
        indented ? "bg-jii-mint-light border-l-2 pl-8" : "bg-card pl-4",
      )}
      onPress={() => onPress?.(id)}
    >
      {/* Top: answers */}
      <Text
        className={cn(
          answersTextStyle({ state: hasAnswers }),
          hasAnswers ? "text-on-surface" : "text-muted-body",
        )}
        numberOfLines={1}
      >
        {hasAnswers ? answersText : t("recentMeasurements:list.noQuestionsAnswered")}
      </Text>

      {/* Bottom row: experiment name on left, timestamp + icon on right */}
      <View className="flex-row items-center justify-between">
        <View className="mr-2 flex-1 flex-row items-center gap-1">
          <Text className="text-muted-body shrink text-sm font-normal" numberOfLines={1}>
            {experimentName}
          </Text>
          {hasComment && <MessageCircleMore size={14} color={colors.inactive} />}
        </View>

        <View className="flex-row items-center gap-1.5">
          {!hideActions && (
            <View className="flex-row gap-1">
              {!isSynced && !isSyncing && !!onSync && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    onSync?.(id);
                  }}
                  className="h-8 w-8 items-center justify-center rounded-lg"
                  style={{ backgroundColor: colors.semantic.info }}
                  activeOpacity={0.8}
                >
                  <UploadCloud size={16} color="#fff" />
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    onDelete(id);
                  }}
                  className="h-8 w-8 items-center justify-center rounded-lg"
                  style={{ backgroundColor: colors.semantic.error }}
                  activeOpacity={0.8}
                >
                  <Trash2 size={16} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          )}
          <Text className="text-muted-body shrink-0 text-sm" numberOfLines={1}>
            {formatTimeAgo(timestamp)}
          </Text>
          {STATUS_ICON[status](colors)}
        </View>
      </View>
    </Pressable>
  );
});
