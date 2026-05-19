import { describe, it, expect, vi, beforeEach } from "vitest";

import { useMeasurementUpload } from "../use-measurement-upload";

const {
  mockSaveMeasurement,
  mockClaimForUpload,
  mockMarkUploaded,
  mockMarkFailed,
  mockSendMqttEvent,
  mockExportSingle,
  mockToastSuccess,
  mockToastError,
  mockToastInfo,
  mockShowAlert,
  mockUseNetworkState,
} = vi.hoisted(() => ({
  mockSaveMeasurement: vi.fn(),
  mockClaimForUpload: vi.fn(),
  mockMarkUploaded: vi.fn(),
  mockMarkFailed: vi.fn(),
  mockSendMqttEvent: vi.fn(),
  mockExportSingle: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockToastInfo: vi.fn(),
  mockShowAlert: vi.fn(),
  mockUseNetworkState: vi.fn(),
}));

let capturedCallback: (...args: any[]) => Promise<any>;

vi.mock("~/features/recent-measurements/hooks/use-measurements", () => ({
  useMeasurements: () => ({
    saveMeasurement: mockSaveMeasurement,
    claimForUpload: mockClaimForUpload,
    markUploaded: mockMarkUploaded,
    markFailed: mockMarkFailed,
  }),
}));

vi.mock("~/features/connection/services/mqtt/send-mqtt-event", () => ({
  sendMqttEvent: mockSendMqttEvent,
}));

vi.mock("~/features/recent-measurements/services/export-measurements", () => ({
  exportSingleMeasurementToFile: mockExportSingle,
}));

vi.mock("~/shared/utils/compress-sample", () => ({
  compressSample: (s: any) => s,
}));

vi.mock("~/features/connection/utils/get-multispeq-mqtt-topic", () => ({
  getMultispeqMqttTopic: () => "mock/topic",
}));

vi.mock("~/shared/utils/measurement-annotations", () => ({
  buildAnnotations: (c?: string) =>
    c ? [{ type: "comment", content: { text: c, flagType: null } }] : [],
}));

vi.mock("sonner-native", () => ({
  toast: { success: mockToastSuccess, error: mockToastError, info: mockToastInfo },
}));

vi.mock("~/shared/ui/AlertDialog", () => ({
  showAlert: mockShowAlert,
}));

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "common:dismiss": "Dismiss",
        "recentMeasurements:alerts.saveErrorTitle": "Something went wrong",
        "recentMeasurements:alerts.saveErrorMessage":
          "Could not save the measurement. Would you like to save it as a file instead?",
        "recentMeasurements:alerts.saveToFileButton": "Save to File",
        "recentMeasurements:alerts.saveToFileError":
          "Could not save measurement. Please try again.",
        "recentMeasurements:toasts.uploadNotAvailable":
          "Upload not available, upload it later from Recent",
        "recentMeasurements:toasts.measurementUploaded": "Measurement uploaded!",
        "recentMeasurements:toasts.uploadedLocalStatusRefresh":
          "Uploaded — local status will refresh on next sync",
        "recentMeasurements:toasts.savedOffline":
          "Saved offline — will upload when you're back online",
      };
      return map[key] ?? key;
    },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: ({ mutationFn }: { mutationFn: (...args: any[]) => Promise<any> }) => {
    capturedCallback = mutationFn;
    return { isPending: false, mutateAsync: mutationFn };
  },
}));

vi.mock("expo-network", () => ({
  useNetworkState: mockUseNetworkState,
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
    mockUseNetworkState.mockReturnValue({ isInternetReachable: true });
    // Default: the upload hook always wins the claim — individual tests
    // override this to simulate a parallel claimant.
    mockClaimForUpload.mockImplementation(async (keys: string[]) => keys);
    useMeasurementUpload();
  });

  it("persists the measurement as pending first, then marks it uploaded on MQTT success", async () => {
    mockSaveMeasurement.mockResolvedValueOnce("row-1");
    mockSendMqttEvent.mockResolvedValueOnce(undefined);
    mockMarkUploaded.mockResolvedValueOnce(undefined);

    await capturedCallback(baseArgs);

    expect(mockSaveMeasurement).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "mock/topic" }),
      "pending",
    );
    expect(mockSendMqttEvent).toHaveBeenCalled();
    expect(mockMarkUploaded).toHaveBeenCalledWith("row-1");
    expect(mockMarkFailed).not.toHaveBeenCalled();
    expect(mockToastSuccess).toHaveBeenCalledWith("Measurement uploaded!");
    expect(mockSaveMeasurement).toHaveBeenCalledTimes(1);
  });

  // Regression: when the device is offline we must not attempt the MQTT
  // publish (Cognito would throw) and must not flip the row to "failed".
  // The row stays "pending" so useAutoUpload picks it up on reconnect.
  it("leaves the row pending and skips MQTT when the device is offline", async () => {
    mockSaveMeasurement.mockResolvedValueOnce("row-1");
    mockUseNetworkState.mockReturnValue({ isInternetReachable: false });
    useMeasurementUpload();

    await capturedCallback(baseArgs);

    expect(mockSaveMeasurement).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "mock/topic" }),
      "pending",
    );
    expect(mockSendMqttEvent).not.toHaveBeenCalled();
    expect(mockMarkFailed).not.toHaveBeenCalled();
    expect(mockMarkUploaded).not.toHaveBeenCalled();
    expect(mockToastInfo).toHaveBeenCalledWith(
      "Saved offline — will upload when you're back online",
    );
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("transitions the pending row to failed when MQTT upload errors out", async () => {
    const uploadError = new Error("network timeout");
    mockSaveMeasurement.mockResolvedValueOnce("row-1");
    mockSendMqttEvent.mockRejectedValueOnce(uploadError);
    mockMarkFailed.mockResolvedValueOnce(undefined);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

    await capturedCallback(baseArgs);

    expect(mockSaveMeasurement).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "mock/topic" }),
      "pending",
    );
    expect(mockMarkUploaded).not.toHaveBeenCalled();
    expect(mockMarkFailed).toHaveBeenCalledWith("row-1");
    expect(mockToastError).toHaveBeenCalledWith(
      "Upload not available, upload it later from Recent",
    );
    expect(mockShowAlert).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith("Upload failed:", uploadError);

    consoleSpy.mockRestore();
  });

  it("prompts file save when local storage fails (upload is never attempted)", async () => {
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
    mockSaveMeasurement.mockResolvedValueOnce("row-1");
    mockSendMqttEvent.mockResolvedValueOnce(undefined);
    mockMarkUploaded.mockResolvedValueOnce(undefined);

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

  // Once the MQTT publish has succeeded the data is on the cloud, so a
  // later local-state write failure must surface as an info toast (and
  // leave the row's status alone) rather than the "upload failed" path.
  it("shows an info toast and does not touch status when markUploaded errors after a successful publish", async () => {
    mockSaveMeasurement.mockResolvedValueOnce("row-1");
    mockSendMqttEvent.mockResolvedValueOnce(undefined);
    mockMarkUploaded.mockRejectedValueOnce(new Error("disk full"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

    await capturedCallback(baseArgs);

    expect(mockMarkFailed).not.toHaveBeenCalled();
    expect(mockToastError).not.toHaveBeenCalled();
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(mockToastInfo).toHaveBeenCalledWith("Uploaded — local status will refresh on next sync");
    expect(consoleSpy).toHaveBeenCalledWith(
      "Local status update failed after successful publish:",
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });
});
