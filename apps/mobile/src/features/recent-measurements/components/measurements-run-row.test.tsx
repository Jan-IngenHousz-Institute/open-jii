import { render, screen, fireEvent } from "@testing-library/react-native";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MeasurementItem } from "~/features/recent-measurements/hooks/use-all-measurements";
import type { MeasurementRunEntry } from "~/features/recent-measurements/utils/group-measurements-by-run";

import { MeasurementsRunRow } from "./measurements-run-row";

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      const count = vars?.count as number | undefined;
      const map: Record<string, string> = {
        "swipe.uploadButton": "Upload",
        "swipe.deleteButton": "Delete",
        "recentMeasurements:list.runMeasurementCount": `${count} measurements`,
        "recentMeasurements:list.noQuestionsAnswered": "No questions answered",
        "recentMeasurements:list.expandRun": "Expand workbook run",
        "recentMeasurements:list.collapseRun": "Collapse workbook run",
      };
      return map[key] ?? key;
    },
  }),
}));

const { mockUseIsOnline } = vi.hoisted(() => ({
  mockUseIsOnline: vi.fn((): { data: boolean | undefined } => ({ data: true })),
}));
vi.mock("~/shared/ui/hooks/use-is-online", () => ({
  useIsOnline: () => mockUseIsOnline(),
}));

// react-native-gesture-handler uses native code; stub the gesture surface.
vi.mock("react-native-gesture-handler", () => {
  const GestureDetector = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  const Gesture = {
    Pan: () => ({
      activeOffsetX: () => Gesture.Pan(),
      failOffsetY: () => Gesture.Pan(),
      onStart: () => Gesture.Pan(),
      onUpdate: () => Gesture.Pan(),
      onEnd: () => Gesture.Pan(),
    }),
  };
  return { __esModule: true, GestureDetector, Gesture };
});

function item(key: string, status: MeasurementItem["status"]): MeasurementItem {
  return {
    id: key,
    key,
    timestamp: "2026-05-18T08:00:00.000Z",
    experimentName: "Photosynthesis",
    protocolName: "proto",
    status,
    questions: [],
    hasComment: false,
    dayKey: "2026-05-18",
    workbookRunId: "run-1",
  };
}

function entry(...items: MeasurementItem[]): MeasurementRunEntry {
  return { key: "run:run-1", runId: "run-1", items };
}

const defaultProps = {
  expanded: false,
  onToggle: vi.fn(),
  onSync: vi.fn(),
  onDelete: vi.fn(),
};

describe("MeasurementsRunRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIsOnline.mockReturnValue({ data: true });
  });

  it("shows the experiment name and how many measurements the run holds", () => {
    render(
      <MeasurementsRunRow
        {...defaultProps}
        entry={entry(item("a", "successful"), item("b", "successful"), item("c", "successful"))}
      />,
    );
    expect(screen.getByText("Photosynthesis")).toBeTruthy();
    expect(screen.getByText("3 measurements")).toBeTruthy();
  });

  it("toggles the run open when the row is pressed", () => {
    const onToggle = vi.fn();
    render(
      <MeasurementsRunRow
        {...defaultProps}
        onToggle={onToggle}
        entry={entry(item("a", "successful"), item("b", "successful"))}
      />,
    );
    fireEvent.press(screen.getByText("Photosynthesis"));
    expect(onToggle).toHaveBeenCalledWith("run:run-1");
  });

  it("announces its expanded state for screen readers", () => {
    render(
      <MeasurementsRunRow
        {...defaultProps}
        expanded
        entry={entry(item("a", "successful"), item("b", "successful"))}
      />,
    );
    expect(screen.getByLabelText("Collapse workbook run")).toBeTruthy();
  });

  it("offers Upload for a run that still has unsynced measurements", () => {
    render(
      <MeasurementsRunRow
        {...defaultProps}
        entry={entry(item("a", "successful"), item("b", "pending"))}
      />,
    );
    expect(screen.getByLabelText("Upload")).toBeTruthy();
  });

  it("hides Upload once every measurement in the run synced", () => {
    render(
      <MeasurementsRunRow
        {...defaultProps}
        entry={entry(item("a", "successful"), item("b", "successful"))}
      />,
    );
    expect(screen.queryByLabelText("Upload")).toBeNull();
  });

  it("deletes the whole run, keyed by the run row id", () => {
    const onDelete = vi.fn();
    render(
      <MeasurementsRunRow
        {...defaultProps}
        onDelete={onDelete}
        entry={entry(item("a", "successful"), item("b", "successful"))}
      />,
    );
    fireEvent.press(screen.getByLabelText("Delete"));
    expect(onDelete).toHaveBeenCalledWith("run:run-1");
  });
});
