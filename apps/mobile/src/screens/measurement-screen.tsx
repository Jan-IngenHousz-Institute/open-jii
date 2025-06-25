import { AlertTriangle, ArrowLeft, Bluetooth, Radio, Usb } from "lucide-react-native";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Button } from "~/components/Button";
import { Card } from "~/components/Card";
import { Dropdown } from "~/components/Dropdown";
import { MeasurementResult } from "~/components/MeasurementResult";
import { Toast } from "~/components/Toast";
import { colors } from "~/constants/colors";
import { useDeviceConnection } from "~/hooks/use-device-connection";
import { Device, useDevices } from "~/hooks/use-devices";
import { useExperimentsDropdownOptions } from "~/hooks/use-experiments-dropdown-options";
import { useTheme } from "~/hooks/use-theme";
import { mockProtocols } from "~/mocks/mock-protocols";

const { height } = Dimensions.get("window");

export function MeasurementScreen() {
  const theme = useTheme();
  const { colors } = theme;
  const { options } = useExperimentsDropdownOptions();
  const { isLoading: loadingDevices, startScan, devices } = useDevices("bluetooth-classic");
  const { connectToDevice, connectingDeviceId } = useDeviceConnection();

  const [currentStep, setCurrentStep] = useState(1);

  const [isOnline] = useState(true);
  const [bluetoothConnected, setBluetoothConnected] = useState(false);
  const [usbConnected, setUsbConnected] = useState(false);
  const [, setDeviceName] = useState<string | undefined>(undefined);

  const [selectedProtocol, setSelectedProtocol] = useState<string | undefined>(undefined);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [measurementData, setMeasurementData] = useState<any>(null);
  const [showDeviceList, setShowDeviceList] = useState(false);
  const [selectedConnectionType, setSelectedConnectionType] = useState<
    "bluetooth" | "ble" | "usb" | null
  >(null);
  const [selectedExperiment, setSelectedExperiment] = useState<string | null>(null);
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "info" as "success" | "error" | "info" | "warning",
  });

  const handleSelectConnectionType = (type: "bluetooth" | "ble" | "usb") => {
    setSelectedConnectionType(type);
    setShowDeviceList(false);
  };

  const handleScanForDevices = () => {
    if (!selectedConnectionType) {
      setToast({
        visible: true,
        message: "Please select a connection type first",
        type: "warning",
      });
      return;
    }

    setShowDeviceList(true);
    startScan()
      .then((devices) =>
        setToast({
          visible: !devices.length,
          message: "No devices found",
          type: "info",
        }),
      )
      .catch(() =>
        setToast({
          visible: true,
          message: "Failed to scan for devices",
          type: "error",
        }),
      );
  };

  const handleConnectToDevice = async (device: Device) => {
    try {
      console.log("handleConnectToDevice", device);
      await connectToDevice(device);

      // Update connection state based on device type
      if (device.type === "bluetooth-classic" || device.type === "ble") {
        setBluetoothConnected(true);
        setUsbConnected(false);
      } else if (device.type === "usb") {
        setUsbConnected(true);
        setBluetoothConnected(false);
      }

      setDeviceName(device.name);
      setShowDeviceList(false);

      setToast({
        visible: true,
        message: `Connected to ${device.name}`,
        type: "success",
      });

      // Move to step 2 after successful connection
      setCurrentStep(2);
    } catch {
      console.log("connect error");
      setToast({
        visible: true,
        message: "Connection failed",
        type: "error",
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      // Simulate disconnection
      await new Promise((resolve) => setTimeout(resolve, 500));

      setBluetoothConnected(false);
      setUsbConnected(false);
      setDeviceName(undefined);

      setMeasurementData(null);

      setToast({
        visible: true,
        message: "Disconnected successfully",
        type: "info",
      });

      // Go back to step 1
      setCurrentStep(1);
    } catch {
      setToast({
        visible: true,
        message: "Failed to disconnect",
        type: "error",
      });
    }
  };

  const handleStartMeasurement = async () => {
    if (!selectedExperiment) {
      setToast({
        visible: true,
        message: "Please select an experiment before starting a measurement",
        type: "warning",
      });
      return;
    }

    if (!selectedProtocol) {
      setToast({
        visible: true,
        message: "Please select a measurement protocol",
        type: "warning",
      });
      return;
    }

    setIsMeasuring(true);

    try {
      // Simulate measurement
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Generate mock measurement data based on protocol
      let mockData;

      switch (selectedProtocol) {
        case "standard":
          mockData = {
            protocol: "standard",
            experiment: options.find((e) => e.value === selectedExperiment)?.label,
            timestamp: new Date().toISOString(),
            readings: {
              absorbance: [0.12, 0.15, 0.18, 0.22, 0.25],
              wavelengths: [450, 500, 550, 600, 650],
            },
            metadata: {
              device_id: "MS2-1234",
              firmware_version: "2.1.0",
              battery_level: 85,
            },
          };
          break;
        case "extended":
          mockData = {
            protocol: "extended",
            experiment: options.find((e) => e.value === selectedExperiment)?.label,
            timestamp: new Date().toISOString(),
            readings: {
              absorbance: [0.12, 0.15, 0.18, 0.22, 0.25, 0.28, 0.3],
              wavelengths: [400, 450, 500, 550, 600, 650, 700],
              fluorescence: {
                f0: 300,
                fm: 1200,
                fv_fm: 0.75,
              },
              temperature: 24.5,
              humidity: 65,
            },
            metadata: {
              device_id: "MS2-1234",
              firmware_version: "2.1.0",
              battery_level: 82,
              measurement_duration: 2.5,
            },
          };
          break;
        case "quick":
          mockData = {
            protocol: "quick",
            experiment: options.find((e) => e.value === selectedExperiment)?.label,
            timestamp: new Date().toISOString(),
            readings: {
              absorbance_avg: 0.18,
              temperature: 24.5,
            },
            metadata: {
              device_id: "MS2-1234",
              firmware_version: "2.1.0",
            },
          };
          break;
      }

      setMeasurementData(mockData);

      setToast({
        visible: true,
        message: "Measurement completed",
        type: "success",
      });
    } catch {
      setToast({
        visible: true,
        message: "Measurement failed",
        type: "error",
      });
    } finally {
      setIsMeasuring(false);
    }
  };

  const handleUploadMeasurement = async () => {
    if (!measurementData) {
      setToast({
        visible: true,
        message: "No measurement data to upload",
        type: "warning",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Simulate upload
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check if online
      if (isOnline) {
        setToast({
          visible: true,
          message: "Measurement uploaded successfully",
          type: "success",
        });

        // Clear measurement data after successful upload
        setMeasurementData(null);
      } else {
        setToast({
          visible: true,
          message: "Upload failed: You are offline. Measurement saved locally.",
          type: "warning",
        });
      }
    } catch {
      setToast({
        visible: true,
        message: "Upload failed",
        type: "error",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const isConnected = bluetoothConnected || usbConnected;
  const experimentName = selectedExperiment
    ? options.find((e) => e.value === selectedExperiment)?.label
    : "No experiment selected";

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
    <ScrollView contentContainerStyle={styles.setupScrollContent}>
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
          selectedValue={selectedExperiment ?? undefined}
          onSelect={(value) => setSelectedExperiment(value)}
          placeholder="Choose an experiment"
        />
      </View>

      {!selectedExperiment && (
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

      {selectedExperiment && (
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
            <TouchableOpacity
              style={[
                styles.connectionTypeButton,
                {
                  backgroundColor: theme.isDark ? colors.dark.card : colors.light.card,
                },
                selectedConnectionType === "bluetooth" && [
                  styles.selectedConnectionType,
                  {
                    borderColor: colors.primary.dark,
                    backgroundColor: colors.primary.dark + "10",
                  },
                ],
              ]}
              onPress={() => handleSelectConnectionType("bluetooth")}
              disabled={Platform.OS === "ios"}
            >
              <Bluetooth
                size={24}
                color={
                  selectedConnectionType === "bluetooth"
                    ? colors.primary.dark
                    : Platform.OS === "ios"
                      ? theme.isDark
                        ? colors.dark.inactive
                        : colors.light.inactive
                      : theme.isDark
                        ? colors.dark.onSurface
                        : colors.light.onSurface
                }
              />
              <Text
                style={[
                  styles.connectionTypeText,
                  {
                    color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
                  },
                  selectedConnectionType === "bluetooth" && [
                    styles.selectedConnectionTypeText,
                    { color: colors.primary.dark },
                  ],
                  Platform.OS === "ios" && [
                    styles.disabledText,
                    {
                      color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
                    },
                  ],
                ]}
              >
                Bluetooth Classic
              </Text>
              {Platform.OS === "ios" && (
                <Text
                  style={[
                    styles.platformNote,
                    {
                      color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
                    },
                  ]}
                >
                  Android only
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.connectionTypeButton,
                {
                  backgroundColor: theme.isDark ? colors.dark.card : colors.light.card,
                },
                selectedConnectionType === "ble" && [
                  styles.selectedConnectionType,
                  {
                    borderColor: colors.primary.dark,
                    backgroundColor: colors.primary.dark + "10",
                  },
                ],
              ]}
              onPress={() => handleSelectConnectionType("ble")}
            >
              <Radio
                size={24}
                color={
                  selectedConnectionType === "ble"
                    ? colors.primary.dark
                    : theme.isDark
                      ? colors.dark.onSurface
                      : colors.light.onSurface
                }
              />
              <Text
                style={[
                  styles.connectionTypeText,
                  {
                    color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
                  },
                  selectedConnectionType === "ble" && [
                    styles.selectedConnectionTypeText,
                    { color: colors.primary.dark },
                  ],
                ]}
              >
                Bluetooth LE
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.connectionTypeButton,
                {
                  backgroundColor: theme.isDark ? colors.dark.card : colors.light.card,
                },
                selectedConnectionType === "usb" && [
                  styles.selectedConnectionType,
                  {
                    borderColor: colors.primary.dark,
                    backgroundColor: colors.primary.dark + "10",
                  },
                ],
              ]}
              onPress={() => handleSelectConnectionType("usb")}
              disabled={Platform.OS === "ios"}
            >
              <Usb
                size={24}
                color={
                  selectedConnectionType === "usb"
                    ? colors.primary.dark
                    : Platform.OS === "ios"
                      ? theme.isDark
                        ? colors.dark.inactive
                        : colors.light.inactive
                      : theme.isDark
                        ? colors.dark.onSurface
                        : colors.light.onSurface
                }
              />
              <Text
                style={[
                  styles.connectionTypeText,
                  {
                    color: theme.isDark ? colors.dark.onSurface : colors.light.onSurface,
                  },
                  selectedConnectionType === "usb" && [
                    styles.selectedConnectionTypeText,
                    { color: colors.primary.dark },
                  ],
                  Platform.OS === "ios" && [
                    styles.disabledText,
                    {
                      color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
                    },
                  ],
                ]}
              >
                USB Serial
              </Text>
              {Platform.OS === "ios" && (
                <Text
                  style={[
                    styles.platformNote,
                    {
                      color: theme.isDark ? colors.dark.inactive : colors.light.inactive,
                    },
                  ]}
                >
                  Android only
                </Text>
              )}
            </TouchableOpacity>
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
    </ScrollView>
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
          options={mockProtocols}
          selectedValue={selectedProtocol}
          onSelect={setSelectedProtocol}
          placeholder="Select protocol"
        />

        <Button
          title="Start Measurement"
          onPress={handleStartMeasurement}
          isLoading={isMeasuring}
          isDisabled={!isConnected || !selectedProtocol}
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
                timestamp={measurementData.timestamp}
                experimentName={measurementData.experiment}
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
          onPress={handleUploadMeasurement}
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

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast({ ...toast, visible: false })}
      />
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
