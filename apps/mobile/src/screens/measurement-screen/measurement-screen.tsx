import { useKeepAwake } from "expo-keep-awake";
import React, { useRef } from "react";
import { ActivityIndicator, Dimensions, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/Button";
import { Dropdown } from "~/components/Dropdown";
import { MeasurementResult } from "~/components/MeasurementResult";
import { useToast } from "~/context/toast-context";
import { useExperiments } from "~/hooks/use-experiments";
import { useMacros } from "~/hooks/use-macros";
import { useMeasurementUpload } from "~/hooks/use-measurement-upload";
import { useProtocols } from "~/hooks/use-protocols";
import { useTheme } from "~/hooks/use-theme";
import { useConnectedDevice } from "~/services/device-connection-manager/device-connection-manager";
import { useScanner } from "~/services/scan-manager/scan-manager";
import { useExperimentSelectionStore } from "~/stores/use-experiment-selection-store";
import { useMacroSelectionStore } from "~/stores/use-macro-selection-store";
import { useProtocolSelectionStore } from "~/stores/use-protocol-selection-store";

const { height } = Dimensions.get("window");

export function MeasurementScreen() {
  useKeepAwake();
  const theme = useTheme();
  const { colors } = theme;
  const { experiments } = useExperiments();
  const { macros } = useMacros();
  const { protocols } = useProtocols();

  const { executeScan, isScanning, reset: resetScan, result: scanResult } = useScanner();
  const { data: device } = useConnectedDevice();

  const isCancellingRef = useRef(false);

  const { selectedProtocolId, setSelectedProtocolId } = useProtocolSelectionStore();
  const { selectedExperimentId, setSelectedExperimentId } = useExperimentSelectionStore();
  const { selectedMacroId, setSelectedMacroId } = useMacroSelectionStore();

  const timestamp = (scanResult as any)?.timestamp;

  const experimentName = selectedExperimentId
    ? experiments.find((e) => e.value === selectedExperimentId)?.label
    : "N/A";

  const { isUploading, uploadMeasurement } = useMeasurementUpload({
    protocolName: selectedProtocolId,
    experimentId: selectedExperimentId,
    experimentName,
  });

  const { showToast } = useToast();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark ? colors.dark.background : colors.light.background,
        },
      ]}
    >
      <View style={styles.measurementStepContainer}>
        <Dropdown
          label="Experiment"
          options={experiments}
          selectedValue={selectedExperimentId}
          onSelect={(value) => setSelectedExperimentId(value)}
          placeholder="Choose an experiment"
        />
        <Dropdown
          label="Protocol"
          options={protocols}
          selectedValue={selectedProtocolId}
          onSelect={(value) => {
            setSelectedProtocolId(value);
            resetScan();
          }}
          placeholder="Select protocol"
        />
        <Dropdown
          label="Macro"
          options={macros}
          selectedValue={selectedMacroId}
          onSelect={(value) => setSelectedMacroId(value)}
          placeholder="Select protocol"
        />

        {isScanning ? (
          <Button
            title="Cancel Measurement"
            onPress={() => {
              isCancellingRef.current = true;
              resetScan();
            }}
            variant="outline"
            style={styles.startButton}
            textStyle={{ color: colors.semantic.error }}
          />
        ) : (
          <Button
            title="Start Measurement"
            onPress={async () => {
              isCancellingRef.current = false;
              if (!selectedProtocolId || !selectedMacroId) {
                return;
              }
              if (!device) {
                showToast("Not connected to sensor", "error");
                return;
              }
              resetScan();
              try {
                await executeScan(selectedProtocolId, selectedMacroId);
              } catch (error) {
                console.log("scan error", error);
                showToast("Scan error", "error");
              }
            }}
            isDisabled={!selectedProtocolId || !selectedExperimentId || !selectedMacroId}
            style={styles.startButton}
          />
        )}

        <View style={styles.resultContainer}>
          {isScanning ? (
            <View
              style={[
                styles.noResultContainer,
                {
                  backgroundColor: theme.isDark ? colors.dark.card : colors.light.card,
                },
              ]}
            >
              <ActivityIndicator size="large" color={colors.primary.dark} />
              <Text
                style={[
                  styles.noResultText,
                  {
                    color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
                  },
                ]}
              >
                Measuring...
              </Text>
            </View>
          ) : scanResult ? (
            <View style={styles.resultContent}>
              <Text
                style={[
                  styles.resultTitle,
                  {
                    color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
                  },
                ]}
              >
                Measurement Result
              </Text>
              <View style={styles.resultDataContainer}>
                <MeasurementResult
                  data={scanResult}
                  timestamp={timestamp}
                  experimentName={experimentName}
                />
              </View>
            </View>
          ) : (
            <View
              style={[
                styles.noResultContainer,
                {
                  backgroundColor: theme.isDark ? colors.dark.card : colors.light.card,
                },
              ]}
            >
              <Text
                style={[
                  styles.noResultText,
                  {
                    color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
                  },
                ]}
              >
                No measurement data yet. Start a measurement to see results here.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.uploadContainer}>
          <Button
            title="Upload Measurement"
            onPress={async () => {
              if (typeof scanResult !== "object") {
                return showToast("Invalid data, upload failed", "error");
              }
              await uploadMeasurement(scanResult);
              resetScan();
            }}
            isLoading={isUploading}
            isDisabled={!scanResult}
            style={styles.uploadButton}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 16,
  },
  setupScrollContent: {
    padding: 16,
    paddingBottom: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  measurementStepContainer: {
    flex: 1,
    paddingLeft: 16,
    paddingRight: 16,
    justifyContent: "space-between",
  },
  startButton: {
    marginTop: 8,
  },
  resultContainer: {
    flex: 1,
    justifyContent: "center",
    marginVertical: 16,
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  resultDataContainer: {
    flex: 1,
    maxHeight: height * 0.5,
  },
  noResultContainer: {
    flex: 1,
    borderRadius: 8,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  noResultText: {
    textAlign: "center",
    fontSize: 16,
  },
  uploadContainer: {
    marginTop: 16,
  },
  uploadButton: {
    width: "100%",
  },
});
