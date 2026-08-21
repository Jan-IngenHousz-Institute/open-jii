import { render, screen } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { MeasurementResult } from "./measurement-result";

const { chartProps, messageProps } = vi.hoisted(() => ({
  chartProps: vi.fn(),
  messageProps: vi.fn(),
}));

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { message?: string }) =>
      options?.message ? `${key}: ${options.message}` : key,
  }),
}));
vi.mock("~/shared/ui/hooks/use-theme", () => ({
  useTheme: () => ({
    classes: { text: "", textSecondary: "", card: "", border: "" },
    colors: { brand: "#000000" },
  }),
}));
vi.mock("~/shared/ui/TabBar", () => ({ TabBar: () => null }));
vi.mock("~/shared/ui/measurement/chart", () => ({
  Chart: (props: { name: string; values: number[] }) => {
    chartProps(props);
    return <Text testID={`chart-${props.name}`}>{props.values.join(",")}</Text>;
  },
}));
vi.mock("~/shared/ui/measurement/macro-messages", () => ({
  MacroMessages: (props: { messages: unknown[] }) => {
    messageProps(props);
    return <Text testID="macro-messages">{JSON.stringify(props.messages)}</Text>;
  },
}));

beforeEach(() => {
  chartProps.mockClear();
  messageProps.mockClear();
});

describe("MeasurementResult", () => {
  it("renders macro values, numeric arrays as charts, and messages", () => {
    const output = {
      chlorophyll: 42,
      trace: [1, 2, 3],
      messages: { warning: ["Only the first measurement was processed"] },
    };

    render(<MeasurementResult rawMeasurement={{ sample: [{ phi2: 0.8 }] }} outputs={[output]} />);

    expect(screen.getByText("chlorophyll")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByTestId("chart-trace").props.children).toBe("1,2,3");
    expect(chartProps).toHaveBeenCalledTimes(1);
    expect(chartProps).toHaveBeenCalledWith({ name: "trace", values: [1, 2, 3] });
    expect(messageProps).toHaveBeenCalledWith({ messages: [output.messages] });
  });

  it("collapses fields the macro measured no value for behind a count", () => {
    render(
      <MeasurementResult
        rawMeasurement={{}}
        outputs={[{ orientation_valid: false, compass_deg: null, pitch_deg: null }]}
      />,
    );

    // The one real value stays visible; the two empties are summarised.
    expect(screen.getByText("false")).toBeTruthy();
    expect(screen.getByText("measurementFlow:result.emptyFields")).toBeTruthy();
    expect(screen.queryByText("compass_deg")).toBeNull();
  });

  it("says the macro measured nothing when every field is empty", () => {
    render(<MeasurementResult rawMeasurement={{}} outputs={[{ compass_deg: null }]} />);

    expect(screen.getByText("measurementFlow:result.allFieldsEmpty")).toBeTruthy();
  });

  it("keeps structured output reachable instead of dropping it", () => {
    render(<MeasurementResult rawMeasurement={{}} outputs={[{ order: ["a", "b"] }]} />);

    expect(screen.getByText("measurementFlow:result.structuredFields")).toBeTruthy();
  });

  it("renders the failure the caller reports instead of any result", () => {
    render(
      <MeasurementResult
        rawMeasurement={{ sample: [] }}
        outputs={undefined}
        error={new Error("Macro input rejected: empty-envelope")}
      />,
    );

    expect(
      screen.getByText(
        "measurementFlow:result.processingError: Macro input rejected: empty-envelope",
      ),
    ).toBeTruthy();
    expect(chartProps).not.toHaveBeenCalled();
    expect(messageProps).not.toHaveBeenCalled();
  });

  it("says so when the macro produced nothing", () => {
    render(<MeasurementResult rawMeasurement={{ phi2: 0.8 }} outputs={[]} />);

    expect(screen.getByText("measurementFlow:result.noDataAvailable")).toBeTruthy();
  });

  it("shows no comment row unless the caller offers one", () => {
    render(<MeasurementResult rawMeasurement={{}} outputs={[]} />);
    expect(screen.queryByText("measurementFlow:result.comment")).toBeNull();

    render(<MeasurementResult rawMeasurement={{}} outputs={[]} onCommentPress={vi.fn()} />);
    expect(screen.getByText("measurementFlow:result.comment")).toBeTruthy();
  });
});
