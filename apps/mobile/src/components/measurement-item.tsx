import { cva } from "class-variance-authority";
import { clsx } from "clsx";
import { UploadCloud, Trash2, CloudCheck, CloudAlert, MessageCircle } from "lucide-react-native";
import React from "react";
import { View, Text, TouchableOpacity, Pressable } from "react-native";
import type { MeasurementStatus } from "~/hooks/use-all-measurements";
import { useTheme } from "~/hooks/use-theme";
import { AnswerData } from "~/utils/convert-cycle-answers-to-array";
import { formatTimeAgo } from "~/utils/format-time-ago";

const answersTextStyle = cva("mb-1.5 text-base", {
  variants: {
    state: {
      true: "font-medium",
      false: "font-normal italic",
    },
  },
});

interface MeasurementItemProps {
  id: string;
  timestamp: string;
  experimentName: string;
  status: MeasurementStatus;
  questions?: AnswerData[];
  onPress?: () => void;
  onSync?: (id: string) => void;
  onDelete?: (id: string) => void;
  /** When true, action buttons (sync/delete) are hidden - e.g. when used inside a swipeable row */
  hideActions?: boolean;
  /** When true, shows a comment indicator icon */
  hasComment?: boolean;
}

export function MeasurementItem({
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
}: MeasurementItemProps) {
  const { colors, classes } = useTheme();
  const isSynced = status === "synced";

  const hasAnswers = questions && questions.length > 0;
  const answersText = hasAnswers ? questions.map((q) => q.question_answer).join(" | ") : null;

  return (
    <Pressable
      className={clsx("border-t px-4 py-3", classes.card, classes.border)}
      onPress={onPress}
    >
      {/* Top: answers */}
      <Text
        className={clsx(
          answersTextStyle({ state: hasAnswers }),
          hasAnswers ? classes.text : classes.textMuted,
        )}
        numberOfLines={1}
      >
        {hasAnswers ? answersText : "No questions answered"}
      </Text>

      {/* Bottom row: experiment name on left, timestamp + icon on right */}
      <View className="flex-row items-center justify-between">
        <Text
          className={clsx("mr-2 flex-1 text-sm font-normal", classes.textMuted)}
          numberOfLines={1}
        >
          {experimentName}
        </Text>

        <View className="flex-row items-center gap-1.5">
          {!hideActions && (
            <View className="flex-row gap-1">
              {!isSynced && (
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
          {hasComment && (
            <MessageCircle size={14} color={colors.onSurface} />
          )}
          <Text className={clsx("shrink-0 text-sm", classes.textMuted)} numberOfLines={1}>
            {formatTimeAgo(timestamp)}
          </Text>
          {isSynced ? (
            <CloudCheck size={16} color={colors.semantic.success} />
          ) : (
            <CloudAlert size={16} color={colors.semantic.error} />
          )}
        </View>
      </View>
    </Pressable>
  );
}
