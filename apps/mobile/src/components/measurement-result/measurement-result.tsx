import { clsx } from "clsx";
import { ChevronRight, MessageCircle } from "lucide-react-native";
import React, { useState } from "react";
import { useAsync } from "react-async-hook";
import { View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import { Button } from "~/components/Button";
import { TabBar } from "~/components/TabBar";
import { useTheme } from "~/hooks/use-theme";
import {
  installPythonRuntime,
  PythonRuntimeNotReadyError,
} from "~/services/python/python-runtime-installer";
import { usePythonRuntimeStore } from "~/stores/python-runtime-store";
import { applyMacro } from "~/utils/process-scan/process-scan";

import { Chart } from "./components/chart";
import { KeyValue } from "./components/key-value";
import { MacroMessages, MacroMessageGroup } from "./components/macro-messages";

const TABS = [
  { key: "result", label: "Results" },
  { key: "raw", label: "Raw data" },
];

type TabKey = (typeof TABS)[number]["key"];

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
  const [activeTab, setActiveTab] = useState<TabKey>("result");

  const {
    result: processedMeasurement,
    loading: isProcessing,
    error: processingError,
  } = useAsync(async () => {
    return await applyMacro(rawMeasurement, macro);
  }, [rawMeasurement, macro]);

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
      if (processingError.name === PythonRuntimeNotReadyError.name) {
        return <PythonRuntimeNotReadyPrompt />;
      }
      return (
        <View className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
          <Text className={clsx("text-sm text-red-600 dark:text-red-400", classes.text)}>
            Processing Error: {processingError.message}
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
            No Data Available
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
            <MessageCircle size={18} color={colors.brand} />
            <Text className={clsx("text-[15px] font-medium", classes.text)}>Comment</Text>
          </View>
          <ChevronRight size={16} color={colors.brand} />
        </TouchableOpacity>
      )}

      {/* Macro messages */}
      {messageGroups.length > 0 && <MacroMessages messages={messageGroups} />}

      {/* Tab bar */}
      <TabBar tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      {activeTab === "raw" ? renderRawContent() : renderProcessedContent()}
    </View>
  );
}

function PythonRuntimeNotReadyPrompt() {
  const state = usePythonRuntimeStore((s) => s.state);
  const progress = usePythonRuntimeStore((s) => s.progress);
  const error = usePythonRuntimeStore((s) => s.error);

  const handleInstall = async () => {
    try {
      await installPythonRuntime();
    } catch {
      // Errors land in the store; the UI re-renders with the failed state.
    }
  };

  const isInstalling = state === "installing";
  const isFailed = state === "failed";

  return (
    <View className="gap-3 rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
      <Text className="text-sm font-semibold text-amber-900 dark:text-amber-100">
        Python macro support not installed
      </Text>
      <Text className="text-sm text-amber-800 dark:text-amber-200">
        This macro uses Python. Download Pyodide + scientific packages (~100 MB) to run it on this
        device. Required once; runs offline afterwards.
      </Text>
      {isInstalling ? (
        <Text className="text-sm text-amber-800 dark:text-amber-200">
          Installing… {Math.round(progress * 100)}%
        </Text>
      ) : null}
      {isFailed && error ? (
        <Text className="text-sm text-red-700 dark:text-red-300">Install failed: {error}</Text>
      ) : null}
      <Button
        title={isFailed ? "Retry download (~100 MB)" : "Download (~100 MB)"}
        onPress={handleInstall}
        variant="primary"
        isLoading={isInstalling}
        isDisabled={isInstalling}
      />
    </View>
  );
}
