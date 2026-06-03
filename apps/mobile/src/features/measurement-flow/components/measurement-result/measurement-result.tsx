import { useQuery } from "@tanstack/react-query";
import { clsx } from "clsx";
import { ChevronRight, MessageCircleMore } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { applyMacro } from "~/features/measurement-flow/utils/process-scan/process-scan";
import { useTranslation } from "~/shared/i18n";
import { TabBar } from "~/shared/ui/TabBar";
import { useTheme } from "~/shared/ui/hooks/use-theme";

import { Chart } from "./components/chart";
import { KeyValue } from "./components/key-value";
import { MacroMessages, MacroMessageGroup } from "./components/macro-messages";

type TabKey = "result" | "raw";

interface MeasurementResultProps {
  rawMeasurement: any;
  macro: any;
  /** When set, shows a Comment row that calls this on press */
  onCommentPress?: () => void;
}

export function MeasurementResult({
  rawMeasurement,
  macro,
  onCommentPress,
}: MeasurementResultProps) {
  const { classes, colors } = useTheme();
  const { t } = useTranslation("measurementFlow");
  const [activeTab, setActiveTab] = useState<TabKey>("result");

  const tabs = useMemo<{ key: TabKey; label: string }[]>(
    () => [
      { key: "result", label: t("measurementFlow:result.tabResults") },
      { key: "raw", label: t("measurementFlow:result.tabRaw") },
    ],
    [t],
  );

  const {
    data: processedMeasurement,
    isLoading: isProcessing,
    error: processingError,
  } = useQuery({
    // applyMacro is a pure local computation; "always" keeps it from being
    // paused by the onlineManager while offline.
    networkMode: "always",
    queryKey: ["measurement-result", rawMeasurement, macro],
    queryFn: () => applyMacro(rawMeasurement, macro),
  });

  const messageGroups: MacroMessageGroup[] =
    processedMeasurement
      ?.map((output) => output.messages)
      .filter((msg): msg is MacroMessageGroup => msg !== undefined) ?? [];

  const renderRawContent = () => (
    <Text className={clsx("font-mono text-sm leading-5", classes.text)}>
      {JSON.stringify(rawMeasurement, null, 2)}
    </Text>
  );

  const renderProcessedContent = () => {
    if (processingError) {
      return (
        <View className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
          <Text className={clsx("text-sm text-red-600 dark:text-red-400", classes.text)}>
            {t("measurementFlow:result.processingError", { message: processingError.message })}
          </Text>
        </View>
      );
    }

    if (isProcessing) {
      return <ActivityIndicator size="large" color={colors.brand} />;
    }

    if (!processedMeasurement?.length) {
      return (
        <View className="items-center justify-center p-6">
          <Text className={clsx("text-center text-lg", classes.textSecondary)}>
            {t("measurementFlow:result.noDataAvailable")}
          </Text>
        </View>
      );
    }

    return (
      <View>
        {processedMeasurement.map((output, outputIndex) => {
          return (
            <View key={outputIndex}>
              {Object.keys(output)
                .filter((key) => key !== "messages")
                .map((key) => {
                  const value = output[key];
                  if (typeof value === "string" || typeof value === "number") {
                    return <KeyValue key={key} value={value} name={key} />;
                  }
                  if (Array.isArray(value) && typeof value[0] === "number") {
                    return <Chart key={key} name={key} values={value} />;
                  }
                  return null;
                })}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View className="gap-4">
      {/* Comment button */}
      {onCommentPress && (
        <TouchableOpacity
          className={clsx(
            "flex-row items-center justify-between rounded-lg border px-3 py-3",
            classes.card,
            classes.border,
          )}
          activeOpacity={0.7}
          onPress={onCommentPress}
        >
          <View className="flex-row items-center gap-2">
            <MessageCircleMore size={18} color={colors.brand} />
            <Text className={clsx("text-[15px] font-medium", classes.text)}>
              {t("measurementFlow:result.comment")}
            </Text>
          </View>
          <ChevronRight size={16} color={colors.brand} />
        </TouchableOpacity>
      )}

      {/* Macro messages */}
      {messageGroups.length > 0 && <MacroMessages messages={messageGroups} />}

      {/* Tab bar */}
      <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === "raw" ? renderRawContent() : renderProcessedContent()}
    </View>
  );
}
