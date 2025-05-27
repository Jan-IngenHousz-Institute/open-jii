/**
 * Mock data utilities for development and testing
 */
import { subDays, subHours, addDays, isValid } from "date-fns";

// Sensor types
export interface SensorReading {
  id: string;
  sensorId: string;
  sensorName: string;
  value: number;
  unit: string;
  timestamp: string;
}

export interface SensorSummary {
  sensorId: string;
  sensorName: string;
  type: string;
  status: "online" | "offline" | "warning";
  lastReading: number;
  unit: string;
  average: number;
  min: number;
  max: number;
  readingsCount: number;
}

// Notification types
export interface Notification {
  id: string;
  type: "info" | "warning" | "error" | "success";
  message: string;
  timestamp: string;
  read: boolean;
}

/**
 * Generate a random sensor reading
 */
export const generateRandomSensorReading = (
  sensorId: string,
  sensorName: string,
  baseValue: number,
  variance: number,
  unit: string,
  timestamp: Date = new Date(),
): SensorReading => {
  const randomVariance = (Math.random() - 0.5) * variance;
  return {
    id: `reading_${Math.random().toString(36).substring(2, 11)}`,
    sensorId,
    sensorName,
    value: +(baseValue + randomVariance).toFixed(2),
    unit,
    timestamp: timestamp.toISOString(),
  };
};

/**
 * Generate historical sensor data with a time series
 */
export const generateHistoricalSensorData = (
  sensorId: string,
  sensorName: string,
  baseValue: number,
  variance: number,
  unit: string,
  days = 7,
  readingsPerDay = 24,
): SensorReading[] => {
  const readings: SensorReading[] = [];
  const now = new Date();

  for (let day = days; day >= 0; day--) {
    for (let i = 0; i < readingsPerDay; i++) {
      const timestamp = subHours(subDays(now, day), 24 - i);
      readings.push(
        generateRandomSensorReading(
          sensorId,
          sensorName,
          baseValue,
          variance,
          unit,
          timestamp,
        ),
      );
    }
  }

  return readings;
};

/**
 * Generate a list of sensor summaries for an experiment
 */
export const generateMockSensorSummaries = (count = 5): SensorSummary[] => {
  const sensorTypes = [
    { name: "Temperature", baseValue: 24, variance: 5, unit: "°C" },
    { name: "Humidity", baseValue: 60, variance: 20, unit: "%" },
    { name: "Light", baseValue: 450, variance: 200, unit: "lux" },
    { name: "CO2", baseValue: 400, variance: 150, unit: "ppm" },
    { name: "Soil Moisture", baseValue: 35, variance: 15, unit: "%" },
  ];

  return Array(count)
    .fill(0)
    .map((_, index) => {
      const sensorType = sensorTypes[index % sensorTypes.length];
      const lastReading =
        sensorType.baseValue + (Math.random() - 0.5) * sensorType.variance;
      const min = lastReading - Math.random() * sensorType.variance * 0.5;
      const max = lastReading + Math.random() * sensorType.variance * 0.5;
      const average = (min + max) / 2;

      return {
        sensorId: `sensor-${index}`,
        sensorName: `${sensorType.name} Sensor ${index + 1}`,
        type: sensorType.name,
        status:
          Math.random() > 0.2
            ? "online"
            : Math.random() > 0.5
              ? "offline"
              : "warning",
        lastReading: +lastReading.toFixed(2),
        unit: sensorType.unit,
        average: +average.toFixed(2),
        min: +min.toFixed(2),
        max: +max.toFixed(2),
        readingsCount: Math.floor(Math.random() * 1000) + 500,
      };
    });
};

/**
 * Generate a list of mock notifications for an experiment
 */
export const generateMockNotifications = (count = 10): Notification[] => {
  const notificationTypes: ("info" | "warning" | "error" | "success")[] = [
    "info",
    "warning",
    "error",
    "success",
  ];

  const notificationMessages = [
    "Sensor readings updated",
    "New data available for analysis",
    "Temperature threshold exceeded",
    "Humidity level critical",
    "Soil moisture below threshold",
    "Maintenance required for sensor",
    "Experiment milestone reached",
    "Data backup complete",
    "System update applied",
    "New user joined the experiment",
  ];

  return Array(count)
    .fill(0)
    .map((_) => {
      const type =
        notificationTypes[Math.floor(Math.random() * notificationTypes.length)];
      const message =
        notificationMessages[
          Math.floor(Math.random() * notificationMessages.length)
        ];
      const daysAgo = Math.floor(Math.random() * 14);
      const hoursAgo = Math.floor(Math.random() * 24);

      return {
        id: `notification-${Math.random().toString(36).substring(2, 11)}`,
        type,
        message,
        timestamp: (() => {
          const date = new Date();
          const daysSubtracted = subDays(date, daysAgo);
          const final = subHours(daysSubtracted, hoursAgo);
          return isValid(final) ? final.toISOString() : date.toISOString();
        })(),
        read: Math.random() > 0.3,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
};

/**
 * Generate mock events for an experiment timeline
 */
export interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  type: "milestone" | "observation" | "maintenance" | "data";
  timestamp: string;
}

export const generateMockTimeline = (count = 8): TimelineEvent[] => {
  const eventTypes: ("milestone" | "observation" | "maintenance" | "data")[] = [
    "milestone",
    "observation",
    "maintenance",
    "data",
  ];

  const eventTitles = {
    milestone: [
      "Experiment Started",
      "Phase 1 Complete",
      "Mid-point Reached",
      "Final Data Collection",
    ],
    observation: [
      "Unusual Growth Pattern",
      "Unexpected Sensor Reading",
      "Environmental Anomaly",
      "Specimen Response",
    ],
    maintenance: [
      "Sensors Calibrated",
      "Equipment Replaced",
      "System Update",
      "Maintenance Check",
    ],
    data: [
      "Data Snapshot Created",
      "Analysis Complete",
      "Data Exported",
      "Backup Created",
    ],
  };

  return Array(count)
    .fill(0)
    .map((_) => {
      const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
      const title =
        eventTitles[type][Math.floor(Math.random() * eventTitles[type].length)];
      const daysAgo = Math.floor(Math.random() * 30);

      return {
        id: `event-${Math.random().toString(36).substring(2, 11)}`,
        title,
        description: `Details about the ${title.toLowerCase()} event that occurred ${daysAgo} days ago.`,
        type,
        timestamp: subDays(new Date(), daysAgo).toISOString(),
      };
    })
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
};

/**
 * Generate mock data for experiment phases
 */
export interface ExperimentPhase {
  id: string;
  name: string;
  status: "upcoming" | "active" | "completed";
  startDate: string;
  endDate: string;
  progress: number; // 0-100
  description: string;
}

export const generateMockExperimentPhases = (): ExperimentPhase[] => {
  const now = new Date();

  return [
    {
      id: "phase-1",
      name: "Setup and Calibration",
      status: "completed",
      startDate: subDays(now, 30).toISOString(),
      endDate: subDays(now, 20).toISOString(),
      progress: 100,
      description: "Initial equipment setup and sensor calibration",
    },
    {
      id: "phase-2",
      name: "Data Collection",
      status: "active",
      startDate: subDays(now, 19).toISOString(),
      endDate: addDays(now, 10).toISOString(),
      progress: 65,
      description: "Primary data collection period with continuous monitoring",
    },
    {
      id: "phase-3",
      name: "Analysis and Reporting",
      status: "upcoming",
      startDate: addDays(now, 11).toISOString(),
      endDate: addDays(now, 25).toISOString(),
      progress: 0,
      description: "Data analysis and preparation of research findings",
    },
  ];
};
