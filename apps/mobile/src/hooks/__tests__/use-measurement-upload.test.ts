import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted so mock fns are available inside vi.mock factories
const {
  mockInvalidateQueries,
  mockSaveFailedUpload,
  mockSendMqttEvent,
  mockSaveSuccessfulUpload,
  mockExportSingle,
  mockToastSuccess,
  mockToastError,
  mockAlertAlert,
} = vi.hoisted(() => ({
  mockInvalidateQueries: vi.fn().mockResolvedValue(undefined),
  mockSaveFailedUpload: vi.fn(),
  mockSendMqttEvent: vi.fn(),
  mockSaveSuccessfulUpload: vi.fn(),
  mockExportSingle: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockAlertAlert: vi.fn(),
}));

let capturedCallback: (...args: any[]) => Promise<any>;

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}));

vi.mock("~/hooks/use-failed-uploads", () => ({
  useFailedUploads: () => ({ saveFailedUpload: mockSaveFailedUpload }),
}));

vi.mock("~/services/mqtt/send-mqtt-event", () => ({
  sendMqttEvent: mockSendMqttEvent,
}));

vi.mock("~/services/successful-uploads-storage", () => ({
  saveSuccessfulUpload: mockSaveSuccessfulUpload,
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
  buildAnnotationsWithComment: (c: string) => [{ comment: c }],
}));

vi.mock("sonner-native", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

vi.mock("react-native", () => ({
  Alert: { alert: mockAlertAlert },
}));

vi.mock("react-async-hook", () => ({
  useAsyncCallback: (fn: (...args: any[]) => Promise<any>) => {
    capturedCallback = fn;
    return { loading: false, execute: fn };
  },
}));

import { useMeasurementUpload } from "../use-measurement-upload";

const baseArgs = {
  rawMeasurement: { data: 1 },
  timestamp: "2026-03-02T10:00:00.000Z",
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
    // Trigger the hook to capture the callback
    useMeasurementUpload();
  });

  it("uploads successfully and saves to successful storage", async () => {
    mockSendMqttEvent.mockResolvedValueOnce(undefined);
    mockSaveSuccessfulUpload.mockResolvedValueOnce(undefined);

    await capturedCallback(baseArgs);

    expect(mockSendMqttEvent).toHaveBeenCalled();
    expect(mockToastSuccess).toHaveBeenCalledWith("Measurement uploaded!");
    expect(mockSaveSuccessfulUpload).toHaveBeenCalled();
    expect(mockSaveFailedUpload).not.toHaveBeenCalled();
  });

  it("saves to failed uploads when MQTT upload fails", async () => {
    mockSendMqttEvent.mockRejectedValueOnce(new Error("offline"));
    mockSaveFailedUpload.mockResolvedValueOnce(undefined);

    await capturedCallback(baseArgs);

    expect(mockToastError).toHaveBeenCalledWith(
      "Upload not available, upload it later from Recent",
    );
    expect(mockSaveFailedUpload).toHaveBeenCalled();
    expect(mockAlertAlert).not.toHaveBeenCalled();
  });

  it("prompts file save when both upload and local storage fail", async () => {
    mockSendMqttEvent.mockRejectedValueOnce(new Error("offline"));
    mockSaveFailedUpload.mockRejectedValueOnce(new Error("storage full"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

    await capturedCallback(baseArgs);

    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to save measurement to local storage:",
      expect.any(Error),
    );

    expect(mockAlertAlert).toHaveBeenCalledWith(
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
    mockSaveFailedUpload.mockRejectedValueOnce(new Error("storage full"));
    mockExportSingle.mockResolvedValueOnce(undefined);

    vi.spyOn(console, "error").mockImplementation(vi.fn());

    await capturedCallback(baseArgs);

    const alertButtons = mockAlertAlert.mock.calls[0][2] as any[];
    const saveButton = alertButtons.find((b: any) => b.text === "Save to File");

    await saveButton.onPress();

    expect(mockExportSingle).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "mock/topic",
        measurementResult: expect.any(Object),
        metadata: expect.objectContaining({
          experimentName: "Test Experiment",
        }),
      }),
    );

    vi.restoreAllMocks();
  });

  it("shows toast error when file export also fails", async () => {
    mockSendMqttEvent.mockRejectedValueOnce(new Error("offline"));
    mockSaveFailedUpload.mockRejectedValueOnce(new Error("storage full"));
    mockExportSingle.mockRejectedValueOnce(new Error("file system error"));

    vi.spyOn(console, "error").mockImplementation(vi.fn());

    await capturedCallback(baseArgs);

    const alertButtons = mockAlertAlert.mock.calls[0][2] as any[];
    const saveButton = alertButtons.find((b: any) => b.text === "Save to File");

    await saveButton.onPress();

    expect(mockToastError).toHaveBeenCalledWith(
      "Could not save measurement. Please try again.",
    );

    vi.restoreAllMocks();
  });

  it("skips upload when rawMeasurement is not an object", async () => {
    await capturedCallback({ ...baseArgs, rawMeasurement: "not-an-object" });

    expect(mockSendMqttEvent).not.toHaveBeenCalled();
    expect(mockSaveFailedUpload).not.toHaveBeenCalled();
  });

  it("logs the upload error", async () => {
    const uploadError = new Error("network timeout");
    mockSendMqttEvent.mockRejectedValueOnce(uploadError);
    mockSaveFailedUpload.mockResolvedValueOnce(undefined);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

    await capturedCallback(baseArgs);

    expect(consoleSpy).toHaveBeenCalledWith("Upload failed:", uploadError);

    consoleSpy.mockRestore();
  });
});
