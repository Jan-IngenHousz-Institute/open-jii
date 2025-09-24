import React, { useRef, useState } from "react";
import { ActivityIndicator, Dimensions, StyleSheet, Text, View } from "react-native";
import { Button } from "~/components/Button";
import { Dropdown } from "~/components/Dropdown";
import { MeasurementResult } from "~/components/MeasurementResult";
import { useToast } from "~/context/toast-context";
import { useExperimentsDropdownOptions } from "~/hooks/use-experiments-dropdown-options";
import { useMeasurementUpload } from "~/hooks/use-measurement-upload";
import { useTheme } from "~/hooks/use-theme";
import { ProtocolName } from "~/protocols/definitions";

import { getProtocolsDropdownOptions } from "./utils/get-protocols-dropdown-options";

const { height } = Dimensions.get("window");

export function MeasurementScreen() {
  const theme = useTheme();
  const { colors } = theme;
  const { options } = useExperimentsDropdownOptions();

  const isCancellingRef = useRef(false);

  const [selectedProtocolName, setSelectedProtocolName] = useState<ProtocolName>();

  const [selectedExperimentId, setSelectedExperimentId] = useState<string>();

  const experimentName = selectedExperimentId
    ? options.find((e) => e.value === selectedExperimentId)?.label
    : "N/A";

  const { isUploading, uploadMeasurement } = useMeasurementUpload({
    protocolName: selectedProtocolName,
    experimentId: selectedExperimentId,
    experimentName,
  });

  const [currentStep, setCurrentStep] = useState(1);

  const { showToast } = useToast();

  const isScanning = false;

  const measurementData = undefined;
  const measurementTimestamp = "13.05.1990.";

  async function handleUpload() {
    // if (typeof measurementData !== "object") {
    //   return showToast("Invalid data, upload failed", "error");
    // }
    // await uploadMeasurement(measurementData);
    // clearResult();
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark ? colors.dark.background : colors.light.background,
        },
      ]}
    >
      <View style={styles.setupScrollContent}>
        <Dropdown
          label="Experiment"
          options={options}
          selectedValue={selectedExperimentId}
          onSelect={(value) => setSelectedExperimentId(value)}
          placeholder="Choose an experiment"
        />
      </View>
      <View style={styles.measurementStepContainer}>
        <Dropdown
          label="Protocol"
          options={getProtocolsDropdownOptions()}
          selectedValue={selectedProtocolName}
          onSelect={(name) => {
            setSelectedProtocolName(name as ProtocolName);
            // clearResult();
          }}
          placeholder="Select protocol"
        />

        {isScanning ? (
          <Button
            title="Cancel Measurement"
            onPress={() => {
              isCancellingRef.current = true;
              // clearResult();
            }}
            variant="outline"
            style={styles.startButton}
            textStyle={{ color: colors.semantic.error }}
          />
        ) : (
          <Button
            title="Start Measurement"
            onPress={() => {
              isCancellingRef.current = false;
              // performMeasurement(selectedProtocolName);
            }}
            isDisabled={!selectedProtocolName || !selectedExperimentId}
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
          ) : measurementData ? (
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
                  data={measurementData}
                  timestamp={measurementTimestamp}
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

        {/* Upload button at the bottom */}
        <View style={styles.uploadContainer}>
          <Button
            title="Upload Measurement"
            onPress={handleUpload}
            isLoading={isUploading}
            isDisabled={!measurementData}
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
