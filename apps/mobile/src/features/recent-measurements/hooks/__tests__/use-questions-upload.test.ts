import { describe, it, expect, vi, beforeEach } from "vitest";

import { useQuestionsUpload } from "../use-questions-upload";

const {
  mockSaveMeasurement,
  mockClaimForUpload,
  mockMarkUploaded,
  mockMarkFailed,
  mockSendMqttEvent,
  mockToastSuccess,
  mockToastError,
  mockToastInfo,
  mockUseNetworkState,
} = vi.hoisted(() => ({
  mockSaveMeasurement: vi.fn(),
  mockClaimForUpload: vi.fn(),
  mockMarkUploaded: vi.fn(),
  mockMarkFailed: vi.fn(),
  mockSendMqttEvent: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockToastInfo: vi.fn(),
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

vi.mock("~/features/connection/utils/get-multispeq-mqtt-topic", () => ({
  getMultispeqMqttTopic: () => "mock/topic",
}));

vi.mock("sonner-native", () => ({
  toast: { success: mockToastSuccess, error: mockToastError, info: mockToastInfo },
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

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "recentMeasurements:toasts.answersSaveFailed":
          "Answers could not be saved on this device. Please export your data now to avoid losing it.",
        "recentMeasurements:toasts.uploadNotAvailable":
          "Upload not available, upload it later from Recent",
        "recentMeasurements:toasts.answersUploaded": "Answers uploaded!",
        "recentMeasurements:toasts.uploadedLocalStatusRefresh":
          "Uploaded — local status will refresh on next sync",
        "recentMeasurements:toasts.savedOffline":
          "Saved offline — will upload when you're back online",
      };
      return map[key] ?? key;
    },
  }),
}));

const baseArgs = {
  timestamp: "2026-03-02T10:00:00.000Z",
  timezone: "Europe/Amsterdam",
  experimentName: "Test Experiment",
  experimentId: "exp-1",
  userId: "user-1",
  questions: [{ id: "q1", answer: "yes" }],
};

describe("useQuestionsUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseNetworkState.mockReturnValue({ isInternetReachable: true });
    // Default: the upload hook always wins the claim — individual tests
    // override this to simulate a parallel claimant.
    mockClaimForUpload.mockImplementation((keys: string[]) => Promise.resolve(keys));
    useQuestionsUpload();
  });

  it("persists answers as pending first, then marks uploaded on MQTT success", async () => {
    mockSaveMeasurement.mockResolvedValueOnce("row-1");
    mockSendMqttEvent.mockResolvedValueOnce(undefined);
    mockMarkUploaded.mockResolvedValueOnce(undefined);

    await capturedCallback(baseArgs);

    expect(mockSaveMeasurement).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "mock/topic" }),
      "pending",
    );
    expect(mockSendMqttEvent).toHaveBeenCalledWith(
      "mock/topic",
      expect.objectContaining({
        questions: baseArgs.questions,
        timestamp: baseArgs.timestamp,
        timezone: baseArgs.timezone,
        user_id: baseArgs.userId,
        macros: null,
        device_id: null,
      }),
    );
    expect(mockMarkUploaded).toHaveBeenCalledWith("row-1");
    expect(mockMarkFailed).not.toHaveBeenCalled();
    expect(mockToastSuccess).toHaveBeenCalledWith("Answers uploaded!");
    expect(mockSaveMeasurement).toHaveBeenCalledTimes(1);
  });

  // Regression: when the device is offline we must not attempt the MQTT
  // publish (Cognito would throw) and must not flip the row to "failed".
  it("leaves the row pending and skips MQTT when the device is offline", async () => {
    mockSaveMeasurement.mockResolvedValueOnce("row-1");
    mockUseNetworkState.mockReturnValue({ isInternetReachable: false });
    useQuestionsUpload();

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
      expect.objectContaining({
        topic: "mock/topic",
        metadata: expect.objectContaining({
          experimentName: baseArgs.experimentName,
          protocolName: "questions",
          timestamp: baseArgs.timestamp,
        }),
      }),
      "pending",
    );
    expect(mockMarkUploaded).not.toHaveBeenCalled();
    expect(mockMarkFailed).toHaveBeenCalledWith("row-1");
    expect(mockToastError).toHaveBeenCalledWith(
      "Upload not available, upload it later from Recent",
    );
    expect(consoleSpy).toHaveBeenCalledWith("Upload failed:", uploadError);

    consoleSpy.mockRestore();
  });

  it("surfaces storage failure via toast + log and never attempts MQTT", async () => {
    mockSaveMeasurement.mockRejectedValueOnce(new Error("storage full"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

    await capturedCallback(baseArgs);

    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to save answers to local storage:",
      expect.any(Error),
    );
    expect(mockToastError).toHaveBeenCalledWith(
      "Answers could not be saved on this device. Please export your data now to avoid losing it.",
    );
    expect(mockSendMqttEvent).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  // Once the MQTT publish has succeeded the answers are on the cloud, so a
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
