import { AlertTriangle, ArrowLeft, Bluetooth, Radio, Usb } from "lucide-react-native";
import React, { useState } from "react";
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
import { Device, DeviceType, useDevices } from "~/hooks/use-devices";
import { useExperimentsDropdownOptions } from "~/hooks/use-experiments-dropdown-options";
import { useMeasurementUpload } from "~/hooks/use-measurement-upload";
import { useTheme } from "~/hooks/use-theme";
import { ProtocolName } from "~/protocols/definitions";

import { ConnectionTypeSelector } from "./components/connection-type-selector";
import { getProtocolsDropdownOptions } from "./utils/get-protocols-dropdown-options";

const { height } = Dimensions.get("window");

export function MeasurementScreen() {
  const theme = useTheme();
  const { colors } = theme;
  const { options } = useExperimentsDropdownOptions();

  const [selectedConnectionType, setSelectedConnectionType] = useState<DeviceType>();

  const { isLoading: loadingDevices, startScan, devices } = useDevices(selectedConnectionType);
  const {
    connect,
    connectingDeviceId,
    performMeasurement,
    measurementData,
    isScanning,
    clearResult,
    disconnect,
    measurementTimestamp,
    isConnected,
  } = useDeviceConnection();

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

  const handleScanForDevices = async () => {
    if (!selectedConnectionType) {
      return showToast("Please select a connection type first", "warning");
    }

    const scanResult = await startScan();

    if (scanResult.isError) {
      return showToast("Failed to scan for devices", "error");
    }

    if (scanResult.data?.length === 0) {
      showToast("No devices found", "info");
    }
  };

  const handleConnectToDevice = async (device: Device) => {
    try {
      console.log("handleConnectToDevice", device);
      await connect(device);
      showToast(`Connected to ${device.name}`, "success");
      setCurrentStep(2);
    } catch {
      console.log("connect error");
      showToast("Connection failed", "error");
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      showToast("Disconnected successfully", "info");
      setCurrentStep(1);
    } catch {
      showToast("Failed to disconnect", "error");
    }
  };

  async function handleUpload() {
    if (typeof measurementData !== "object") {
      return showToast("Invalid data, upload failed", "error");
    }
    await uploadMeasurement(measurementData);
    clearResult();
  }

  const showDeviceList = loadingDevices || !!devices;

  const renderDeviceItem = ({ item }: { item: Device }) => (
    <TouchableOpacity
      style={[
        styles.deviceItem,
        {
          backgroundColor: theme.isDark ? colors.dark.card : colors.light.card,
        },
      ]}
      onPress={() => handleConnectToDevice(item)}
    >
      <View style={styles.deviceInfo}>
        <Text
          style={[
            styles.deviceName,
            {
              color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
            },
          ]}
        >
          {item.name}
        </Text>
        {item.rssi && (
          <Text
            style={[
              styles.deviceRssi,
              {
                color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
              },
            ]}
          >
            Signal: {item.rssi > -70 ? "Strong" : item.rssi > -80 ? "Medium" : "Weak"}
          </Text>
        )}
      </View>
      <View style={styles.deviceTypeContainer}>
        {item.id === connectingDeviceId ? (
          <ActivityIndicator
            size="small"
            color={theme.isDark ? colors.light.onPrimary : colors.dark.onPrimary}
          />
        ) : (
          <>
            {item.type === "bluetooth-classic" && (
              <Bluetooth size={16} color={colors.primary.dark} />
            )}
            {item.type === "ble" && <Radio size={16} color={colors.primary.dark} />}
            {item.type === "usb" && <Usb size={16} color={colors.primary.dark} />}
          </>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderSetupStep = () => (
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

      {!selectedExperimentId && (
        <Card style={styles.warningCard}>
          <View style={styles.warningContent}>
            <AlertTriangle size={20} color={colors.semantic.warning} />
            <Text
              style={[
                styles.warningText,
                {
                  color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
                },
              ]}
            >
              Please select an experiment before connecting to a device
            </Text>
          </View>
        </Card>
      )}

      {selectedExperimentId && (
        <>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
              },
            ]}
          >
            Connection Type
          </Text>
          <View style={styles.connectionTypeContainer}>
            <ConnectionTypeSelector
              type="bluetooth-classic"
              selected={selectedConnectionType === "bluetooth-classic"}
              onSelect={() => setSelectedConnectionType("bluetooth-classic")}
            />
            {process.env.ENABLE_BLE && (
              <ConnectionTypeSelector
                type="ble"
                selected={selectedConnectionType === "ble"}
                onSelect={() => setSelectedConnectionType("ble")}
              />
            )}
            <ConnectionTypeSelector
              type="usb"
              selected={selectedConnectionType === "usb"}
              onSelect={() => setSelectedConnectionType("usb")}
            />
            <ConnectionTypeSelector
              type="mock-device"
              selected={selectedConnectionType === "mock-device"}
              onSelect={() => setSelectedConnectionType("mock-device")}
            />
          </View>

          <View style={styles.actionsContainer}>
            <Button
              title="Scan for Devices"
              onPress={handleScanForDevices}
              isLoading={loadingDevices}
              isDisabled={!selectedConnectionType || !!connectingDeviceId}
              style={styles.actionButton}
            />
          </View>

          {showDeviceList && (
            <View style={styles.deviceListContainer}>
              <Text
                style={[
                  styles.deviceListTitle,
                  {
                    color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
                  },
                ]}
              >
                {loadingDevices ? "Scanning for devices..." : "Available Devices"}
              </Text>

              {!loadingDevices && !devices?.length && (
                <Text
                  style={[
                    styles.emptyDeviceList,
                    {
                      color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
                    },
                  ]}
                >
                  No devices found. Try scanning again.
                </Text>
              )}

              <FlatList
                data={devices ?? []}
                renderItem={renderDeviceItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.deviceList}
              />
            </View>
          )}
        </>
      )}
    </View>
  );

  const renderMeasurementStep = () => (
    <View style={styles.measurementStepContainer}>
      {/* Compact header with experiment name and back button */}
      <View style={styles.compactHeader}>
        <TouchableOpacity style={styles.backButton} onPress={handleDisconnect}>
          <ArrowLeft size={18} color={colors.primary.dark} />
          <Text style={[styles.backButtonText, { color: colors.primary.dark }]}>Back</Text>
        </TouchableOpacity>

        <View
          style={[
            styles.experimentBadge,
            {
              backgroundColor: colors.primary.dark + "20",
              borderColor: colors.primary.dark,
            },
          ]}
        >
          <Text style={[styles.experimentBadgeText, { color: colors.primary.dark }]}>
            {experimentName}
          </Text>
        </View>
      </View>

      <View style={styles.protocolContainer}>
        <Dropdown
          label="Protocol"
          options={getProtocolsDropdownOptions()}
          selectedValue={selectedProtocolName}
          onSelect={(name) => {
            setSelectedProtocolName(name as ProtocolName);
            clearResult();
          }}
          placeholder="Select protocol"
        />

        <Button
          title="Start Measurement"
          onPress={() => performMeasurement(selectedProtocolName)}
          isLoading={isScanning}
          isDisabled={!isConnected || !selectedProtocolName}
          style={styles.startButton}
        />
      </View>

      {/* Measurement result - takes most of the screen */}
      <View style={styles.resultContainer}>
        {measurementData ? (
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
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark ? colors.dark.background : colors.light.background,
        },
      ]}
    >
      {currentStep === 1 ? renderSetupStep() : renderMeasurementStep()}
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
