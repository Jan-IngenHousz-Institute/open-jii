import { describe, it, expect, vi, beforeEach } from "vitest";

import { useMeasurementUpload } from "../use-measurement-upload";

const {
  mockSaveMeasurement,
  mockSendMqttEvent,
  mockExportSingle,
  mockToastSuccess,
  mockToastError,
  mockShowAlert,
} = vi.hoisted(() => ({
  mockSaveMeasurement: vi.fn(),
  mockSendMqttEvent: vi.fn(),
  mockExportSingle: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockShowAlert: vi.fn(),
}));

let capturedCallback: (...args: any[]) => Promise<any>;

vi.mock("~/hooks/use-measurements", () => ({
  useMeasurements: () => ({ saveMeasurement: mockSaveMeasurement }),
}));

vi.mock("~/services/mqtt/send-mqtt-event", () => ({
  sendMqttEvent: mockSendMqttEvent,
}));

vi.mock("~/services/export-measurements", () => ({
  exportSingleMeasurementToFile: mockExportSingle,
}));

vi.mock("~/utils/compress-sample", () => ({
  compressSample: (s: any) => s,
}));

vi.mock("~/utils/get-multispeq-mqtt-topic", () => ({
  getMultispeqMqttTopic: () => "mock/topic",
}));

vi.mock("~/utils/measurement-annotations", () => ({
  buildAnnotations: (c?: string) => (c ? [{ comment: c }] : []),
}));

vi.mock("sonner-native", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

vi.mock("~/components/AlertDialog", () => ({
  showAlert: mockShowAlert,
}));

vi.mock("react-async-hook", () => ({
  useAsyncCallback: (fn: (...args: any[]) => Promise<any>) => {
    capturedCallback = fn;
    return { loading: false, execute: fn };
  },
}));

const baseArgs = {
  rawMeasurement: { data: 1 },
  timestamp: "2026-03-02T10:00:00.000Z",
  timezone: "Europe/Amsterdam",
  experimentName: "Test Experiment",
  experimentId: "exp-1",
  protocolId: "proto-1",
  userId: "user-1",
  macro: { id: "m1", name: "Macro", filename: "macro.js" },
  questions: [],
};

describe("useMeasurementUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMeasurementUpload();
  });

  it("uploads successfully and saves as successful", async () => {
    mockSendMqttEvent.mockResolvedValueOnce(undefined);
    mockSaveMeasurement.mockResolvedValueOnce(undefined);

    await capturedCallback(baseArgs);

    expect(mockSendMqttEvent).toHaveBeenCalled();
    expect(mockToastSuccess).toHaveBeenCalledWith("Measurement uploaded!");
    expect(mockSaveMeasurement).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "mock/topic" }),
      "successful",
    );
  });

  it("saves as failed when MQTT upload fails", async () => {
    mockSendMqttEvent.mockRejectedValueOnce(new Error("offline"));
    mockSaveMeasurement.mockResolvedValueOnce(undefined);

    await capturedCallback(baseArgs);

    expect(mockToastError).toHaveBeenCalledWith(
      "Upload not available, upload it later from Recent",
    );
    expect(mockSaveMeasurement).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "mock/topic" }),
      "failed",
    );
    expect(mockShowAlert).not.toHaveBeenCalled();
  });

  it("prompts file save when both upload and local storage fail", async () => {
    mockSendMqttEvent.mockRejectedValueOnce(new Error("offline"));
    mockSaveMeasurement.mockRejectedValueOnce(new Error("storage full"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

    await capturedCallback(baseArgs);

    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to save measurement to local storage:",
      expect.any(Error),
    );
    expect(mockShowAlert).toHaveBeenCalledWith(
      "Something went wrong",
      "Could not save the measurement. Would you like to save it as a file instead?",
      expect.arrayContaining([
        expect.objectContaining({ text: "Dismiss" }),
        expect.objectContaining({ text: "Save to File" }),
      ]),
    );

    consoleSpy.mockRestore();
  });

  it("calls exportSingleMeasurementToFile when user taps Save to File", async () => {
    mockSendMqttEvent.mockRejectedValueOnce(new Error("offline"));
    mockSaveMeasurement.mockRejectedValueOnce(new Error("storage full"));
    mockExportSingle.mockResolvedValueOnce(undefined);

    vi.spyOn(console, "error").mockImplementation(vi.fn());

    await capturedCallback(baseArgs);

    const alertButtons = mockShowAlert.mock.calls[0][2] as any[];
    const saveButton = alertButtons.find((b: any) => b.text === "Save to File");

    await saveButton.onPress();

    expect(mockExportSingle).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "mock/topic",
        measurementResult: expect.any(Object),
        metadata: expect.objectContaining({ experimentName: "Test Experiment" }),
      }),
    );

    vi.restoreAllMocks();
  });

  it("shows toast error when file export also fails", async () => {
    mockSendMqttEvent.mockRejectedValueOnce(new Error("offline"));
    mockSaveMeasurement.mockRejectedValueOnce(new Error("storage full"));
    mockExportSingle.mockRejectedValueOnce(new Error("file system error"));

    vi.spyOn(console, "error").mockImplementation(vi.fn());

    await capturedCallback(baseArgs);

    const alertButtons = mockShowAlert.mock.calls[0][2] as any[];
    const saveButton = alertButtons.find((b: any) => b.text === "Save to File");

    await saveButton.onPress();

    expect(mockToastError).toHaveBeenCalledWith("Could not save measurement. Please try again.");

    vi.restoreAllMocks();
  });

  it("forwards the UTC timestamp and timezone to the MQTT payload unchanged", async () => {
    mockSendMqttEvent.mockResolvedValueOnce(undefined);
    mockSaveMeasurement.mockResolvedValueOnce(undefined);

    const utcTimestamp = "2026-03-16T13:00:18.022Z";
    const timezone = "Europe/Amsterdam";

    await capturedCallback({ ...baseArgs, timestamp: utcTimestamp, timezone });

    expect(mockSendMqttEvent).toHaveBeenCalledWith(
      "mock/topic",
      expect.objectContaining({ timestamp: utcTimestamp, timezone }),
    );
  });

  it("skips upload when rawMeasurement is not an object", async () => {
    await capturedCallback({ ...baseArgs, rawMeasurement: "not-an-object" });

    expect(mockSendMqttEvent).not.toHaveBeenCalled();
    expect(mockSaveMeasurement).not.toHaveBeenCalled();
  });

  it("logs the upload error", async () => {
    const uploadError = new Error("network timeout");
    mockSendMqttEvent.mockRejectedValueOnce(uploadError);
    mockSaveMeasurement.mockResolvedValueOnce(undefined);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

    await capturedCallback(baseArgs);

    expect(consoleSpy).toHaveBeenCalledWith("Upload failed:", uploadError);

    consoleSpy.mockRestore();
  });
});
