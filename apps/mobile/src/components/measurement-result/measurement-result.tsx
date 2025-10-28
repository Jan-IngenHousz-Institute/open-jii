import { clsx } from "clsx";
import { CheckCircle2, FileText, BarChart2, ChevronRight } from "lucide-react-native";
import React, { useState } from "react";
import { View, Modal, Text, TouchableOpacity } from "react-native";
import { useTheme } from "~/hooks/use-theme";

import { ProcessedMeasurementPreview } from "./components/processed-measurement-preview";
import { RawMeasurementPreview } from "./components/raw-measurement-preview";

interface MeasurementResultProps {
  data: any;
  timestamp?: string;
  experimentName?: string;
}

export function MeasurementResult({ data, timestamp, experimentName }: MeasurementResultProps) {
  const { classes, colors } = useTheme();
  const [showRaw, setShowRaw] = useState(false);
  const [showProcessed, setShowProcessed] = useState(false);

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
          >
            <View className="flex-row items-center gap-2">
              <BarChart2 size={18} color={colors.primary.dark} />
              <Text className={clsx("text-[15px] font-medium", classes.text)}>View result</Text>
            </View>
            <ChevronRight size={16} color={colors.primary.dark} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal visible={showRaw} animationType="slide" presentationStyle="fullScreen">
        <RawMeasurementPreview
          data={data}
          timestamp={timestamp}
          experimentName={experimentName}
          onClose={() => setShowRaw(false)}
        />
      </Modal>

      <Modal visible={showProcessed} animationType="slide" presentationStyle="fullScreen">
        <ProcessedMeasurementPreview
          output={data?.output}
          timestamp={timestamp}
          experimentName={experimentName}
          onClose={() => setShowProcessed(false)}
        />
      </Modal>
    </>
  );
}
