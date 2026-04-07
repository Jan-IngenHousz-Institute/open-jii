import { describe, it, expect, vi, beforeEach } from "vitest";

import { useQuestionsUpload } from "../use-questions-upload";

const { mockSaveMeasurement, mockSendMqttEvent, mockToastSuccess, mockToastError } = vi.hoisted(
  () => ({
    mockSaveMeasurement: vi.fn(),
    mockSendMqttEvent: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
  }),
);

let capturedCallback: (...args: any[]) => Promise<any>;

vi.mock("~/hooks/use-measurements", () => ({
  useMeasurements: () => ({ saveMeasurement: mockSaveMeasurement }),
}));

vi.mock("~/services/mqtt/send-mqtt-event", () => ({
  sendMqttEvent: mockSendMqttEvent,
}));

vi.mock("~/utils/get-multispeq-mqtt-topic", () => ({
  getMultispeqMqttTopic: () => "mock/topic",
}));

vi.mock("sonner-native", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

vi.mock("react-async-hook", () => ({
  useAsyncCallback: (fn: (...args: any[]) => Promise<any>) => {
    capturedCallback = fn;
    return { loading: false, execute: fn };
  },
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
    useQuestionsUpload();
  });

  it("uploads successfully and saves as successful", async () => {
    mockSendMqttEvent.mockResolvedValueOnce(undefined);
    mockSaveMeasurement.mockResolvedValueOnce(undefined);

    await capturedCallback(baseArgs);

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
    expect(mockToastSuccess).toHaveBeenCalledWith("Answers uploaded!");
    expect(mockSaveMeasurement).toHaveBeenCalledWith(
      expect.objectContaining({ topic: "mock/topic" }),
      "successful",
    );
  });

  it("saves as failed when MQTT upload fails", async () => {
    mockSendMqttEvent.mockRejectedValueOnce(new Error("offline"));
    mockSaveMeasurement.mockResolvedValueOnce(undefined);

    vi.spyOn(console, "error").mockImplementation(vi.fn());

    await capturedCallback(baseArgs);

    expect(mockToastError).toHaveBeenCalledWith(
      "Upload not available, upload it later from Recent",
    );
    expect(mockSaveMeasurement).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "mock/topic",
        metadata: expect.objectContaining({
          experimentName: baseArgs.experimentName,
          protocolName: "questions",
          timestamp: baseArgs.timestamp,
        }),
      }),
      "failed",
    );

    vi.restoreAllMocks();
  });

  it("logs the upload error when MQTT fails", async () => {
    const uploadError = new Error("network timeout");
    mockSendMqttEvent.mockRejectedValueOnce(uploadError);
    mockSaveMeasurement.mockResolvedValueOnce(undefined);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

    await capturedCallback(baseArgs);

    expect(consoleSpy).toHaveBeenCalledWith("Upload failed:", uploadError);

    consoleSpy.mockRestore();
  });

  it("logs storage error when both upload and local storage fail", async () => {
    mockSendMqttEvent.mockRejectedValueOnce(new Error("offline"));
    mockSaveMeasurement.mockRejectedValueOnce(new Error("storage full"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

    await capturedCallback(baseArgs);

    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to save answers to local storage:",
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it("shows error toast when local storage also fails", async () => {
    mockSendMqttEvent.mockRejectedValueOnce(new Error("offline"));
    mockSaveMeasurement.mockRejectedValueOnce(new Error("storage full"));

    vi.spyOn(console, "error").mockImplementation(vi.fn());

    await capturedCallback(baseArgs);

    expect(mockToastError).toHaveBeenCalledWith(
      "Answers could not be saved on this device. Please export your data now to avoid losing it.",
    );

    vi.restoreAllMocks();
  });
});
