// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useQuestionsUpload } from "./use-questions-upload";

const { saveMeasurement, enqueue } = vi.hoisted(() => ({
  saveMeasurement: vi.fn(),
  enqueue: vi.fn(),
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
  questions: [],
  workbookRunId: "run-1",
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
  });

  it("stamps the workbook attempt and version on questions-only uploads", async () => {
    const { result } = renderHook(() => useQuestionsUpload(), { wrapper });

    await act(async () => {
      await result.current.uploadQuestions({
        ...shared,
        workbookRunId: "run-1",
        workbookVersionId: "version-1",
      });
    });

    expect(saveMeasurement.mock.calls[0][0].measurementResult).toMatchObject({
      workbook_run_id: "run-1",
      workbook_version_id: "version-1",
    });
    expect(enqueue).toHaveBeenCalledWith("saved-1");
  });
});
