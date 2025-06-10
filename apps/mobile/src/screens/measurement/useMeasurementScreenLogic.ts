import { router } from "expo-router";
import { useState } from "react";
import {
  useMeasurementState,
  useMeasurement,
  useDeviceScan,
  mockExperiments,
} from "~/hooks/useMeasurement";
import type { Device } from "~/types/measurement";

export interface UseMeasurementScreenLogic {
  // Setup state
  selectedExperiment: string | null;
  selectedConnectionType: "bluetooth" | "ble" | "usb" | null;
  showDeviceList: boolean;
  discoveredDevices: Device[];
  isScanning: boolean;

  // Measurement state
  selectedProtocol: string | undefined;
  experimentName: string;
  connectedDevice: any;
  measurementData: any;
  isMeasuring: boolean;
  isUploading: boolean;

  // UI state
  toast: {
    visible: boolean;
    message: string;
    type: "success" | "error" | "info" | "warning";
  };

  // Data
  mockExperiments: { label: string; value: string }[];

  // Setup actions
  handleSelectExperiment: (value: string) => Promise<void>;
  handleSelectConnectionType: (type: "bluetooth" | "ble" | "usb") => void;
  handleScanForDevices: () => Promise<void>;
  handleConnectToDevice: (device: Device) => Promise<void>;

  // Measurement actions
  setSelectedProtocol: (protocol: string) => void;
  handleStartMeasurement: () => Promise<void>;
  handleUploadMeasurement: () => Promise<void>;
  handleDisconnect: () => Promise<void>;

  // UI actions
  setToast: (toast: {
    visible: boolean;
    message: string;
    type: "success" | "error" | "info" | "warning";
  }) => void;
}

export function useMeasurementScreenLogic(): UseMeasurementScreenLogic {
  const {
    selectedExperiment,
    connectedDevice,
    disconnectDevice,
    setSelectedExperiment,
    connectToDevice,
  } = useMeasurementState();
  const { devices: discoveredDevices, isScanning, startScan } = useDeviceScan();
  const {
    measurementData,
    isMeasuring,
    isUploading,
    startMeasurement,
    uploadMeasurement,
    clearMeasurement,
  } = useMeasurement();

  const [selectedConnectionType, setSelectedConnectionType] = useState<
    "bluetooth" | "ble" | "usb" | null
  >(null);
  const [showDeviceList, setShowDeviceList] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<string | undefined>(
    undefined,
  );
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "info" as "success" | "error" | "info" | "warning",
  });

  // This effect will be used in measurement active screen
  // The redirect logic will be handled by the specific screen component

  const experimentName = selectedExperiment
    ? (mockExperiments.find((e) => e.value === selectedExperiment)?.label ??
      "Unknown experiment")
    : "No experiment selected";

  // Setup actions
  const handleSelectExperiment = async (value: string) => {
    try {
      await setSelectedExperiment(value);
      setToast({
        visible: true,
        message: "Experiment selected",
        type: "success",
      });
    } catch {
      setToast({
        visible: true,
        message: "Failed to select experiment",
        type: "error",
      });
    }
  };

  const handleSelectConnectionType = (type: "bluetooth" | "ble" | "usb") => {
    setSelectedConnectionType(type);
    setShowDeviceList(false);
  };

  const handleScanForDevices = async () => {
    if (!selectedConnectionType) {
      setToast({
        visible: true,
        message: "Please select a connection type first",
        type: "warning",
      });
      return;
    }

    try {
      await startScan(selectedConnectionType);
      setShowDeviceList(true);
      setToast({
        visible: true,
        message: "Scanning for devices...",
        type: "info",
      });
    } catch {
      setToast({
        visible: true,
        message: "Failed to start scan",
        type: "error",
      });
    }
  };

  const handleConnectToDevice = async (device: Device) => {
    try {
      await connectToDevice(device);
      setToast({
        visible: true,
        message: `Connected to ${device.name}`,
        type: "success",
      });
      router.push("/measurement-active");
    } catch {
      setToast({
        visible: true,
        message: "Connection failed",
        type: "error",
      });
    }
  };

  // Measurement actions
  const handleStartMeasurement = async () => {
    if (!selectedExperiment || !selectedProtocol) {
      setToast({
        visible: true,
        message: "Please select an experiment and protocol",
        type: "warning",
      });
      return;
    }

    try {
      await startMeasurement(selectedExperiment, selectedProtocol);
      setToast({
        visible: true,
        message: "Measurement completed successfully",
        type: "success",
      });
    } catch {
      setToast({
        visible: true,
        message: "Measurement failed",
        type: "error",
      });
    }
  };

  const handleUploadMeasurement = async () => {
    try {
      await uploadMeasurement();
      setToast({
        visible: true,
        message: "Measurement uploaded successfully",
        type: "success",
      });
    } catch {
      setToast({
        visible: true,
        message: "Upload failed. Data saved locally.",
        type: "error",
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectDevice();
      clearMeasurement();
      setToast({
        visible: true,
        message: "Disconnected from device",
        type: "info",
      });
      router.replace("/setup");
    } catch {
      setToast({
        visible: true,
        message: "Error disconnecting",
        type: "error",
      });
    }
  };

  return {
    // Setup state
    selectedExperiment,
    selectedConnectionType,
    showDeviceList,
    discoveredDevices,
    isScanning,

    // Measurement state
    selectedProtocol,
    experimentName,
    connectedDevice,
    measurementData,
    isMeasuring,
    isUploading,

    // UI state
    toast,

    // Data
    mockExperiments,

    // Setup actions
    handleSelectExperiment,
    handleSelectConnectionType,
    handleScanForDevices,
    handleConnectToDevice,

    // Measurement actions
    setSelectedProtocol,
    handleStartMeasurement,
    handleUploadMeasurement,
    handleDisconnect,

    // UI actions
    setToast,
  };
}
