import { clsx } from "clsx";
import { CheckCircle2, FileText, BarChart2, ChevronRight } from "lucide-react-native";
import React, { useState } from "react";
import { useAsync } from "react-async-hook";
import { View, Modal, Text, TouchableOpacity } from "react-native";
import { useTheme } from "~/hooks/use-theme";
import { applyMacro } from "~/utils/process-scan/process-scan";

import { ProcessedMeasurementPreview } from "./components/processed-measurement-preview";
import { RawMeasurementPreview } from "./components/raw-measurement-preview";

interface MeasurementResultProps {
  rawMeasurement: any;
  macro: any;
  timestamp?: string;
  experimentName?: string;
}

export function MeasurementResult({
  rawMeasurement,
  macro,
  timestamp,
  experimentName,
}: MeasurementResultProps) {
  const { classes, colors } = useTheme();
  const [showRaw, setShowRaw] = useState(false);
  const [showProcessed, setShowProcessed] = useState(false);

  const { result: processedMeasurement, error: processingError } = useAsync(async () => {
    return await applyMacro(rawMeasurement, macro.code);
  }, [rawMeasurement, macro.code]);

  return (
    <>
      <View className={clsx("rounded-xl p-4", classes.card, classes.border)}>
        <View className="mb-3 flex-row items-center gap-2">
          <CheckCircle2 size={18} color="#10b981" />
          <Text className={clsx("text-base font-semibold", classes.text)}>Scan successful</Text>
        </View>

        <View className="mt-2">
          <TouchableOpacity
            className={clsx(
              "mb-2 flex-row items-center justify-between rounded-lg border px-3 py-3",
              classes.card,
              classes.border,
            )}
            activeOpacity={0.7}
            onPress={() => setShowRaw(true)}
          >
            <View className="flex-row items-center gap-2">
              <FileText size={18} color={colors.primary.dark} />
              <Text className={clsx("text-[15px] font-medium", classes.text)}>View raw data</Text>
            </View>
            <ChevronRight size={16} color={colors.primary.dark} />
          </TouchableOpacity>

          <TouchableOpacity
            className={clsx(
              "flex-row items-center justify-between rounded-lg border px-3 py-3",
              classes.card,
              classes.border,
            )}
            activeOpacity={0.7}
            onPress={() => setShowProcessed(true)}
            disabled={!!processingError}
          >
            <View className="flex-row items-center gap-2">
              <BarChart2 size={18} color={processingError ? "#9ca3af" : colors.primary.dark} />
              <Text
                className={clsx(
                  "text-[15px] font-medium",
                  processingError ? classes.textMuted : classes.text,
                )}
              >
                {processingError ? "Processing failed" : "View result"}
              </Text>
            </View>
            {!processingError && <ChevronRight size={16} color={colors.primary.dark} />}
          </TouchableOpacity>

          {processingError && (
            <View className="mt-2 rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
              <Text className={clsx("text-sm text-red-600 dark:text-red-400", classes.text)}>
                Processing Error: {processingError.message}
              </Text>
            </View>
          )}
        </View>
      </View>

      <Modal visible={showRaw} animationType="slide" presentationStyle="fullScreen">
        <RawMeasurementPreview
          data={rawMeasurement}
          timestamp={timestamp}
          experimentName={experimentName}
          onClose={() => setShowRaw(false)}
        />
      </Modal>

      <Modal visible={showProcessed} animationType="slide" presentationStyle="fullScreen">
        <ProcessedMeasurementPreview
          output={processedMeasurement}
          timestamp={timestamp}
          experimentName={experimentName}
          onClose={() => setShowProcessed(false)}
        />
      </Modal>
    </>
  );
}
