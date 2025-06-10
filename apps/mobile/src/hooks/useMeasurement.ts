import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect, useCallback } from "react";
import type {
  Device,
  Experiment,
  Protocol,
  MeasurementData,
} from "~/types/measurement";

// Mock data
export const mockExperiments: Experiment[] = [
  {
    label: "Leaf Photosynthesis",
    value: "leaf_photosynthesis",
    description: "Measures photosynthetic activity in leaves",
  },
  {
    label: "Chlorophyll Fluorescence",
    value: "chlorophyll_fluorescence",
    description: "Analyzes chlorophyll fluorescence parameters",
  },
  {
    label: "Absorbance Spectrum",
    value: "absorbance_spectrum",
    description: "Measures light absorbance across wavelengths",
  },
];

export const mockProtocols: Protocol[] = [
  {
    label: "Standard Protocol",
    value: "standard",
    description: "Basic measurement protocol",
  },
  {
    label: "Extended Protocol",
    value: "extended",
    description: "Detailed measurement with additional parameters",
  },
  {
    label: "Quick Scan",
    value: "quick",
    description: "Rapid measurement with minimal parameters",
  },
];

export const mockDevices: Device[] = [
  { id: "dev1", name: "MultiSpeQ v2.0", rssi: -65, type: "bluetooth" },
  { id: "dev2", name: "MultiSpeQ v2.1", rssi: -72, type: "bluetooth" },
  { id: "dev3", name: "USB Serial Device", rssi: null, type: "usb" },
  { id: "dev4", name: "BLE Device", rssi: -58, type: "ble" },
];

interface UseMeasurementStateReturn {
  // State
  selectedExperiment: string | null;
  connectedDevice: Device | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setSelectedExperiment: (experimentId: string) => Promise<void>;
  connectToDevice: (device: Device) => Promise<void>;
  disconnectDevice: () => Promise<void>;
  clearError: () => void;
  refreshState: () => Promise<void>;
}

export function useMeasurementState(): UseMeasurementStateReturn {
  const [selectedExperiment, setSelectedExperimentState] = useState<
    string | null
  >(null);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load initial state from AsyncStorage
  const loadState = useCallback(async () => {
    try {
      setIsLoading(true);
      const [storedExperiment, storedDevice] = await Promise.all([
        AsyncStorage.getItem("selected_experiment"),
        AsyncStorage.getItem("connected_device"),
      ]);

      if (storedExperiment) {
        setSelectedExperimentState(storedExperiment);
      }

      if (storedDevice) {
        setConnectedDevice(JSON.parse(storedDevice));
      }
    } catch (err) {
      setError("Failed to load measurement state");
      console.error("Error loading measurement state:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const setSelectedExperiment = useCallback(async (experimentId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      await AsyncStorage.setItem("selected_experiment", experimentId);
      setSelectedExperimentState(experimentId);
    } catch (err) {
      setError("Failed to save selected experiment");
      console.error("Error saving selected experiment:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const connectToDevice = useCallback(async (device: Device) => {
    try {
      setIsLoading(true);
      setError(null);

      // Simulate connection delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await AsyncStorage.setItem("connected_device", JSON.stringify(device));
      setConnectedDevice(device);
    } catch (err) {
      setError(`Failed to connect to ${device.name}`);
      console.error("Error connecting to device:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnectDevice = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      await AsyncStorage.removeItem("connected_device");
      setConnectedDevice(null);
    } catch (err) {
      setError("Failed to disconnect device");
      console.error("Error disconnecting device:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refreshState = useCallback(async () => {
    await loadState();
  }, [loadState]);

  return {
    selectedExperiment,
    connectedDevice,
    isLoading,
    error,
    setSelectedExperiment,
    connectToDevice,
    disconnectDevice,
    clearError,
    refreshState,
  };
}

interface UseDeviceScanReturn {
  devices: Device[];
  isScanning: boolean;
  error: string | null;
  startScan: (connectionType: Device["type"]) => Promise<void>;
  stopScan: () => void;
  clearError: () => void;
}

export function useDeviceScan(): UseDeviceScanReturn {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startScan = useCallback(async (connectionType: Device["type"]) => {
    try {
      setIsScanning(true);
      setError(null);
      setDevices([]);

      // Simulate scanning
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Filter devices by connection type
      const filteredDevices = mockDevices.filter(
        (device) => device.type === connectionType,
      );
      setDevices(filteredDevices);

      if (filteredDevices.length === 0) {
        setError("No devices found for the selected connection type");
      }
    } catch (err) {
      setError("Failed to scan for devices");
      console.error("Error scanning for devices:", err);
    } finally {
      setIsScanning(false);
    }
  }, []);

  const stopScan = useCallback(() => {
    setIsScanning(false);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    devices,
    isScanning,
    error,
    startScan,
    stopScan,
    clearError,
  };
}

interface UseMeasurementReturn {
  measurementData: MeasurementData | null;
  isMeasuring: boolean;
  isUploading: boolean;
  error: string | null;
  startMeasurement: (experimentId: string, protocolId: string) => Promise<void>;
  uploadMeasurement: () => Promise<void>;
  clearMeasurement: () => void;
  clearError: () => void;
}

export function useMeasurement(): UseMeasurementReturn {
  const [measurementData, setMeasurementData] =
    useState<MeasurementData | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startMeasurement = useCallback(
    async (experimentId: string, protocolId: string) => {
      try {
        setIsMeasuring(true);
        setError(null);

        // Simulate measurement
        await new Promise((resolve) => setTimeout(resolve, 3000));

        const experiment = mockExperiments.find(
          (e) => e.value === experimentId,
        );
        const protocol = mockProtocols.find((p) => p.value === protocolId);

        const mockData: MeasurementData = {
          timestamp: new Date().toISOString(),
          experiment: experiment?.label || experimentId,
          protocol: protocol?.label || protocolId,
          data: {
            fv_fm: 0.85,
            npq: 1.3,
            phi2: 0.68,
            sample_id: `sample_${Date.now()}`,
          },
          metadata: {
            device_id: "MS2-1234",
            firmware_version: "2.1.0",
            battery_level: 85,
          },
        };

        setMeasurementData(mockData);
      } catch (err) {
        setError("Measurement failed");
        console.error("Error during measurement:", err);
        throw err;
      } finally {
        setIsMeasuring(false);
      }
    },
    [],
  );

  const uploadMeasurement = useCallback(async () => {
    if (!measurementData) {
      setError("No measurement data to upload");
      return;
    }

    try {
      setIsUploading(true);
      setError(null);

      // Simulate upload
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Clear measurement data after successful upload
      setMeasurementData(null);
    } catch (err) {
      setError("Upload failed. Data saved locally.");
      console.error("Error uploading measurement:", err);
      throw err;
    } finally {
      setIsUploading(false);
    }
  }, [measurementData]);

  const clearMeasurement = useCallback(() => {
    setMeasurementData(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    measurementData,
    isMeasuring,
    isUploading,
    error,
    startMeasurement,
    uploadMeasurement,
    clearMeasurement,
    clearError,
  };
}
