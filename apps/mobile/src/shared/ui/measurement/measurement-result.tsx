import { clsx } from "clsx";
import { ChevronRight, MessageCircleMore } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { useTranslation } from "~/shared/i18n";
import type { MacroMessageGroup, MacroOutput } from "~/shared/measurements/macro-output";
import { partitionMacroOutput } from "~/shared/measurements/partition-macro-output";
import { TabBar } from "~/shared/ui/TabBar";
import { useTheme } from "~/shared/ui/hooks/use-theme";
import { Chart } from "~/shared/ui/measurement/chart";
import { MacroFieldDisclosure, MacroFieldGrid } from "~/shared/ui/measurement/macro-field-grid";
import { MacroMessages } from "~/shared/ui/measurement/macro-messages";

type TabKey = "result" | "raw";

interface MeasurementResultProps {
  /** The measurement the macro ran against; shown verbatim on the Raw tab. */
  rawMeasurement: any;
  /** Macro output, already computed by the caller (see useMacroOutputs). */
  outputs: MacroOutput[] | undefined;
  isLoading?: boolean;
  error?: Error | null;
  /** When set, shows a Comment row that calls this on press */
  onCommentPress?: () => void;
}

/**
 * Renders one macro run: its messages, then charts, values, the fields it
 * measured nothing for, and structured leftovers, with the raw input behind a
 * tab. Purely presentational, so the live flow and a stored measurement's
 * re-run show the same thing.
 */
export function MeasurementResult({
  rawMeasurement,
  outputs,
  isLoading = false,
  error,
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

  const messageGroups: MacroMessageGroup[] =
    outputs
      ?.map((output) => output.messages)
      .filter((msg): msg is MacroMessageGroup => msg !== undefined) ?? [];

  // Stringified lazily: pretty-printing the (potentially ~150 KB) payload on
  // every mount costs the sheet's open animation, and the Raw tab is rare.
  const rawJson = useMemo(
    () => (activeTab === "raw" ? JSON.stringify(rawMeasurement, null, 2) : null),
    [activeTab, rawMeasurement],
  );

  const renderRawContent = () => (
    <Text className={clsx("font-mono text-sm leading-5", classes.text)}>{rawJson}</Text>
  );

  const fields = useMemo(() => partitionMacroOutput(outputs), [outputs]);

  const renderProcessedContent = () => {
    if (error) {
      return (
        <View className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
          <Text className={clsx("text-sm text-red-600 dark:text-red-400", classes.text)}>
            {t("measurementFlow:result.processingError", { message: error.message })}
          </Text>
        </View>
      );
    }

    if (isLoading) {
      return <ActivityIndicator size="large" color={colors.brand} />;
    }

    if (!outputs?.length || fields.isEmpty) {
      return (
        <View className="items-center justify-center p-6">
          <Text className={clsx("text-center text-lg", classes.textSecondary)}>
            {t("measurementFlow:result.noDataAvailable")}
          </Text>
        </View>
      );
    }

    // Charts first (the visual payload), then the scalars worth scanning, then
    // what the macro reported without a value, then structured leftovers.
    return (
      <View className="gap-3">
        {fields.charts.map((field, index) => (
          <Chart key={`${index}-${field.name}`} name={field.name} values={field.values} />
        ))}

        {fields.values.length > 0 && <MacroFieldGrid fields={fields.values} />}

        {fields.values.length === 0 && fields.charts.length === 0 && (
          <Text className={clsx("text-sm", classes.textSecondary)}>
            {t("measurementFlow:result.allFieldsEmpty")}
          </Text>
        )}

        {fields.empties.length > 0 && (
          <MacroFieldDisclosure
            label={t("measurementFlow:result.emptyFields", { count: fields.empties.length })}
          >
            <MacroFieldGrid fields={fields.empties} muted />
          </MacroFieldDisclosure>
        )}

        {fields.others.length > 0 && (
          <MacroFieldDisclosure
            label={t("measurementFlow:result.structuredFields", { count: fields.others.length })}
          >
            <View className="gap-3">
              {fields.others.map((field, index) => (
                <View key={`${index}-${field.name}`} className="gap-1">
                  <Text className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">
                    {field.name}
                  </Text>
                  <Text className={clsx("font-mono text-xs leading-5", classes.text)}>
                    {field.json}
                  </Text>
                </View>
              ))}
            </View>
          </MacroFieldDisclosure>
        )}
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
      <TabBar variant="underline" tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === "raw" ? renderRawContent() : renderProcessedContent()}
    </View>
  );
}
