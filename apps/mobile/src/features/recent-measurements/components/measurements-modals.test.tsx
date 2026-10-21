import { render, screen } from "@testing-library/react-native";
import React from "react";
import { Dimensions, View } from "react-native";
import { describe, expect, it, vi } from "vitest";

import { MeasurementsModals } from "./measurements-modals";

const preview = vi.hoisted((): { state: { status: string; blocker?: string } } => ({
  state: { status: "loading" },
}));
vi.mock("~/features/recent-measurements/hooks/use-measurement-macro-preview", () => ({
  useMeasurementMacroPreview: () => preview.state,
}));
vi.mock("~/features/measurement-flow/hooks/use-macro-outputs", () => ({
  useMacroOutputs: () => ({ outputs: [], isLoading: false }),
}));
vi.mock("~/shared/ui/measurement/measurement-questions-modal", () => ({
  MeasurementQuestionsModal: ({ children }: { children: React.ReactNode }) => (
    <View>{children}</View>
  ),
}));
vi.mock("~/shared/ui/measurement/comment-modal", () => ({ CommentModal: () => null }));
vi.mock("~/shared/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

describe("saved simulated measurement detail", () => {
  it.each([320, 768])(
    "retains the label at width %s through loading and errors, and does not carry it to a real result",
    (width) => {
      Dimensions.set({
        window: { width, height: 640, scale: 1, fontScale: 1 },
        screen: { width, height: 640, scale: 1, fontScale: 1 },
      });
      const measurement = {
        id: "saved-simulated",
        status: "failed" as const,
        data: {
          topic: "example",
          measurementResult: { simulated: true, device_id: "simulated:multispeq" },
          metadata: {
            experimentName: "Demo",
            protocolName: "Demo protocol",
            timestamp: "2026-01-01T10:00:00Z",
          },
        },
      };
      const props = { onClose: vi.fn(), onSaveComment: () => Promise.resolve() };
      preview.state = { status: "loading" };
      const view = render(
        <MeasurementsModals {...props} state={{ kind: "questions", measurement }} />,
      );
      expect(screen.getByText("common:simulated")).toBeTruthy();
      preview.state = { status: "unavailable", blocker: "offline" };
      view.rerender(<MeasurementsModals {...props} state={{ kind: "questions", measurement }} />);
      expect(screen.getByText("common:simulated")).toBeTruthy();
      expect(screen.getByText("recentMeasurements:macroPreview.offline")).toBeTruthy();
      view.rerender(
        <MeasurementsModals
          {...props}
          state={{
            kind: "questions",
            measurement: {
              ...measurement,
              data: { ...measurement.data, measurementResult: { simulated: false } },
            },
          }}
        />,
      );
      expect(screen.queryByText("common:simulated")).toBeNull();
    },
  );
});
