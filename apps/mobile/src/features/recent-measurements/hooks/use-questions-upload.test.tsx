// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useQuestionsUpload } from "./use-questions-upload";

const { saveMeasurement, enqueue, platform, device, application } = vi.hoisted(() => {
  const device: {
    modelName: string | null;
    manufacturer: string | null;
    osName: string;
    osVersion: string | null;
  } = {
    modelName: "SM-A165F",
    manufacturer: "samsung",
    osName: "samsung/a16nseea/a16:16/build:user/release-keys",
    osVersion: "16",
  };
  const application: { nativeApplicationVersion: string | null } = {
    nativeApplicationVersion: "2.73.2",
  };
  return {
    saveMeasurement: vi.fn(),
    enqueue: vi.fn(),
    platform: { OS: "android" },
    device,
    application,
  };
});

vi.mock("react-native", () => ({ Platform: platform }));
vi.mock("expo-device", () => device);
vi.mock("expo-application", () => application);

vi.mock("~/features/auth/services/local-upload-identity", () => ({
  getLocalUploadIdentity: () => ({ userId: "user-1", isGuest: false }),
}));
vi.mock("~/features/recent-measurements/hooks/use-measurements", () => ({
  useMeasurements: () => ({ saveMeasurement }),
}));
vi.mock("~/shared/composition/upload", () => ({
  getOutbox: () => ({ enqueue }),
}));
vi.mock("~/shared/stores/device-identity-store", () => ({
  whenDeviceIdentityLoaded: () => Promise.resolve(),
}));
vi.mock("~/shared/measurements/measurement-topic", () => ({
  getMeasurementMqttTopic: ({ experimentId }: { experimentId: string }) => `topic/${experimentId}`,
}));
vi.mock("~/shared/location/measurement-location", () => ({
  getMeasurementLocation: vi.fn(() => Promise.resolve(null)),
}));
vi.mock("~/shared/measurements/measurement-annotations", () => ({
  buildAnnotations: vi.fn(() => null),
}));
vi.mock("sonner-native", () => ({ toast: { error: vi.fn() } }));
vi.mock("~/shared/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const shared = {
  timestamp: "2026-08-14T10:00:00.000Z",
  timezone: "Europe/Amsterdam",
  experimentName: "Trial",
  experimentId: "exp-1",
  userId: "user-1",
  questions: [{ question_label: "plot", question_text: "Plot number?", question_answer: "4" }],
  workbookRunId: "run-1",
  workbookVersionId: "version-1",
};

describe("useQuestionsUpload", () => {
  let client: QueryClient;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    client = new QueryClient();
    vi.clearAllMocks();
    saveMeasurement.mockResolvedValue("saved-1");
    platform.OS = "android";
    Object.assign(device, {
      modelName: "SM-A165F",
      manufacturer: "samsung",
      osName: "samsung/a16nseea/a16:16/build:user/release-keys",
      osVersion: "16",
    });
    application.nativeApplicationVersion = "2.73.2";
  });

  it("persists phone metadata with the answers before enqueueing without sensor attribution", async () => {
    const { result } = renderHook(() => useQuestionsUpload(), { wrapper });

    await act(async () => {
      await result.current.uploadQuestions({
        ...shared,
        workbookRunId: "run-1",
        workbookVersionId: "version-1",
      });
    });

    expect(saveMeasurement).toHaveBeenCalledExactlyOnceWith(
      {
        topic: "topic/exp-1",
        measurementResult: {
          questions: shared.questions,
          timestamp: shared.timestamp,
          timezone: shared.timezone,
          user_id: "user-1",
          workbook_run_id: "run-1",
          workbook_version_id: "version-1",
          annotations: null,
          client_model: "SM-A165F",
          client_manufacturer: "samsung",
          client_os: "Android",
          client_os_version: "16",
          client_app_version: "2.73.2",
        },
        metadata: {
          experimentName: "Trial",
          protocolName: "questions",
          timestamp: shared.timestamp,
        },
      },
      "pending",
      { userId: "user-1", isGuest: false },
    );
    expect(saveMeasurement.mock.invocationCallOrder[0]).toBeLessThan(
      enqueue.mock.invocationCallOrder[0],
    );
    expect(enqueue).toHaveBeenCalledWith("saved-1");
  });

  it("omits unavailable phone fields while still saving and enqueueing the answers", async () => {
    device.modelName = null;
    device.manufacturer = null;
    device.osVersion = null;
    application.nativeApplicationVersion = null;
    const { result } = renderHook(() => useQuestionsUpload(), { wrapper });

    await act(async () => {
      await result.current.uploadQuestions(shared);
    });

    const payload = saveMeasurement.mock.calls[0][0].measurementResult;
    expect(payload).toMatchObject({ client_os: "Android", questions: shared.questions });
    expect(payload).not.toHaveProperty("client_model");
    expect(payload).not.toHaveProperty("client_manufacturer");
    expect(payload).not.toHaveProperty("client_os_version");
    expect(payload).not.toHaveProperty("client_app_version");
    expect(enqueue).toHaveBeenCalledWith("saved-1");
  });

  it("preserves iPadOS for question-only uploads", async () => {
    platform.OS = "ios";
    device.osName = "iPadOS";
    const { result } = renderHook(() => useQuestionsUpload(), { wrapper });

    await act(async () => {
      await result.current.uploadQuestions(shared);
    });

    expect(saveMeasurement.mock.calls[0][0].measurementResult.client_os).toBe("iPadOS");
  });
});
