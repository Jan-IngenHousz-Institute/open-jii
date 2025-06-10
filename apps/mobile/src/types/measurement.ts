export interface MeasurementStackParamList {
  Setup: undefined;
  MeasurementActive: {
    deviceId: string;
    experimentId: string;
  };
}

export type ConnectionType = "bluetooth" | "ble" | "usb";

export interface Device {
  id: string;
  name: string;
  rssi?: number | null;
  type: ConnectionType;
}

export interface Experiment {
  label: string;
  value: string;
  description?: string;
}

export interface Protocol {
  label: string;
  value: string;
  description?: string;
}

export interface MeasurementData {
  timestamp: string;
  experiment: string;
  protocol: string;
  data: Record<string, any>;
  metadata?: Record<string, any>;
}
