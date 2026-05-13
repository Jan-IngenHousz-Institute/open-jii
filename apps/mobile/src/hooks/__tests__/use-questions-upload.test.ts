import { describe, it, expect, vi, beforeEach } from "vitest";

import { useQuestionsUpload } from "../use-questions-upload";

const {
  mockSaveMeasurement,
  mockMarkUploaded,
  mockMarkFailed,
  mockSendMqttEvent,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockSaveMeasurement: vi.fn(),
  mockMarkUploaded: vi.fn(),
  mockMarkFailed: vi.fn(),
  mockSendMqttEvent: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

let capturedCallback: (...args: any[]) => Promise<any>;

vi.mock("~/hooks/use-measurements", () => ({
  useMeasurements: () => ({
    saveMeasurement: mockSaveMeasurement,
    markUploaded: mockMarkUploaded,
    markFailed: mockMarkFailed,
  }),
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

  it("transitions the pending row to failed when MQTT upload errors out", async () => {
    mockSaveMeasurement.mockResolvedValueOnce("row-1");
    mockSendMqttEvent.mockRejectedValueOnce(new Error("offline"));
    mockMarkFailed.mockResolvedValueOnce(undefined);

    vi.spyOn(console, "error").mockImplementation(vi.fn());

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

    vi.restoreAllMocks();
  });

  it("logs the upload error when MQTT fails", async () => {
    const uploadError = new Error("network timeout");
    mockSaveMeasurement.mockResolvedValueOnce("row-1");
    mockSendMqttEvent.mockRejectedValueOnce(uploadError);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

    await capturedCallback(baseArgs);

    expect(consoleSpy).toHaveBeenCalledWith("Upload failed:", uploadError);

    consoleSpy.mockRestore();
  });

  it("logs storage error and does not attempt MQTT when local save fails", async () => {
    mockSaveMeasurement.mockRejectedValueOnce(new Error("storage full"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

    await capturedCallback(baseArgs);

    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to save answers to local storage:",
      expect.any(Error),
    );
    expect(mockSendMqttEvent).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("shows error toast when local storage save fails", async () => {
    mockSaveMeasurement.mockRejectedValueOnce(new Error("storage full"));

    vi.spyOn(console, "error").mockImplementation(vi.fn());

    await capturedCallback(baseArgs);

    expect(mockToastError).toHaveBeenCalledWith(
      "Answers could not be saved on this device. Please export your data now to avoid losing it.",
    );

    vi.restoreAllMocks();
  });
});
