import { AlertTriangle, ArrowLeft, Bluetooth, Radio, Usb } from "lucide-react-native";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Button } from "~/components/Button";
import { Card } from "~/components/Card";
import { Dropdown } from "~/components/Dropdown";
import { MeasurementResult } from "~/components/MeasurementResult";
import { colors } from "~/constants/colors";
import { useToast } from "~/context/toast-context";
import { useDeviceConnection } from "~/hooks/use-device-connection";
import { useDevices } from "~/hooks/use-devices";
import { useExperimentsDropdownOptions } from "~/hooks/use-experiments-dropdown-options";
import { useMeasurementUpload } from "~/hooks/use-measurement-upload";
import { useTheme } from "~/hooks/use-theme";
import { ProtocolName } from "~/protocols/definitions";
import { Device, DeviceType } from "~/types/device";

import { ConnectionTypeSelector } from "./components/connection-type-selector";
import { getProtocolsDropdownOptions } from "./utils/get-protocols-dropdown-options";

const { height } = Dimensions.get("window");

export function MeasurementScreen() {
  const theme = useTheme();
  const { colors } = theme;
  const { options } = useExperimentsDropdownOptions();

  const [selectedConnectionType, setSelectedConnectionType] = useState<DeviceType>();

  const { isLoading: loadingDevices, startScan, devices } = useDevices(selectedConnectionType);

  const isCancellingRef = useRef(false);

  const [selectedProtocolName, setSelectedProtocolName] = useState<ProtocolName>();
  const [selectedExperimentId, setSelectedExperimentId] = useState<string>();

  const experimentName = selectedExperimentId
    ? options.find((e) => e.value === selectedExperimentId)?.label
    : "No experiment selected";

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

  const showDeviceList = loadingDevices || !!devices;

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
        <View style={styles.experimentSection}>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
              },
            ]}
          >
            Select Experiment
          </Text>
          <Dropdown
            options={options}
            selectedValue={selectedExperimentId}
            onSelect={(value) => setSelectedExperimentId(value)}
            placeholder="Choose an experiment"
          />
        </View>
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
            isDisabled={!selectedProtocolName}
            style={styles.startButton}
          />
        )}

        {/* Measurement result - takes most of the screen */}
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
  },
  setupScrollContent: {
    padding: 16,
  },
  experimentSection: {
    marginBottom: 24,
  },
  warningCard: {
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: colors.semantic.warning,
  },
  warningContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  warningText: {
    marginLeft: 8,
    flex: 1,
  },
  connectionTypeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  connectionTypeButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 4,
  },
  selectedConnectionType: {
    borderWidth: 1,
  },
  connectionTypeText: {
    marginTop: 8,
    fontSize: 12,
    textAlign: "center",
  },
  selectedConnectionTypeText: {
    fontWeight: "bold",
  },
  disabledText: {},
  platformNote: {
    fontSize: 10,
    marginTop: 4,
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  deviceListContainer: {
    marginBottom: 24,
  },
  deviceListTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },
  deviceList: {
    paddingBottom: 8,
  },
  deviceItem: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: "500",
  },
  deviceRssi: {
    fontSize: 12,
    marginTop: 4,
  },
  deviceTypeContainer: {
    padding: 8,
  },
  emptyDeviceList: {
    textAlign: "center",
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },

  // Step 2 styles - Measurement screen
  measurementStepContainer: {
    flex: 1,
    padding: 16,
    justifyContent: "space-between",
  },
  compactHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButtonText: {
    marginLeft: 4,
    fontSize: 14,
  },
  experimentBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  experimentBadgeText: {
    fontWeight: "bold",
    fontSize: 14,
  },
  protocolContainer: {
    marginBottom: 16,
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
    maxHeight: height * 0.5, // Take up to 50% of screen height
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
