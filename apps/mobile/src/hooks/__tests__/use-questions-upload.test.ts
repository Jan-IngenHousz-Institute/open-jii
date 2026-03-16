import { describe, it, expect, vi, beforeEach } from "vitest";

import { useQuestionsUpload } from "../use-questions-upload";

const {
  mockInvalidateQueries,
  mockSaveFailedUpload,
  mockSendMqttEvent,
  mockSaveSuccessfulUpload,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockInvalidateQueries: vi.fn().mockResolvedValue(undefined),
  mockSaveFailedUpload: vi.fn(),
  mockSendMqttEvent: vi.fn(),
  mockSaveSuccessfulUpload: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
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
  timezone: "UTC",
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

  it("uploads successfully and saves to successful storage", async () => {
    mockSendMqttEvent.mockResolvedValueOnce(undefined);
    mockSaveSuccessfulUpload.mockResolvedValueOnce(undefined);

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
    expect(mockSaveSuccessfulUpload).toHaveBeenCalled();
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["allMeasurements"] });
    expect(mockSaveFailedUpload).not.toHaveBeenCalled();
  });

  it("saves to failed uploads when MQTT upload fails", async () => {
    mockSendMqttEvent.mockRejectedValueOnce(new Error("offline"));
    mockSaveFailedUpload.mockResolvedValueOnce(undefined);

    vi.spyOn(console, "error").mockImplementation(vi.fn());

    await capturedCallback(baseArgs);

    expect(mockToastError).toHaveBeenCalledWith(
      "Upload not available, upload it later from Recent",
    );
    expect(mockSaveFailedUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: "mock/topic",
        metadata: expect.objectContaining({
          experimentName: baseArgs.experimentName,
          protocolName: "questions",
          timestamp: baseArgs.timestamp,
        }),
      }),
    );
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ["allMeasurements"] });

    vi.restoreAllMocks();
  });

  it("logs the upload error when MQTT fails", async () => {
    const uploadError = new Error("network timeout");
    mockSendMqttEvent.mockRejectedValueOnce(uploadError);
    mockSaveFailedUpload.mockResolvedValueOnce(undefined);

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

    await capturedCallback(baseArgs);

    expect(consoleSpy).toHaveBeenCalledWith("Upload failed:", uploadError);

    consoleSpy.mockRestore();
  });

  it("logs storage error when both upload and local storage fail", async () => {
    mockSendMqttEvent.mockRejectedValueOnce(new Error("offline"));
    mockSaveFailedUpload.mockRejectedValueOnce(new Error("storage full"));

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(vi.fn());

    await capturedCallback(baseArgs);

    expect(consoleSpy).toHaveBeenCalledWith(
      "Failed to save answers to local storage:",
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it("does not invalidate queries when local storage also fails", async () => {
    mockSendMqttEvent.mockRejectedValueOnce(new Error("offline"));
    mockSaveFailedUpload.mockRejectedValueOnce(new Error("storage full"));

    vi.spyOn(console, "error").mockImplementation(vi.fn());

    await capturedCallback(baseArgs);

    // invalidateQueries is only called inside the fallback try block before saveFailedUpload throws
    // The second invalidateQueries call never happens when saveFailedUpload throws
    expect(mockInvalidateQueries).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});
