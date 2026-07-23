import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MeasurementResult } from "./measurement-result";

const { applyMacro, chartProps, messageProps } = vi.hoisted(() => ({
  applyMacro: vi.fn(),
  chartProps: vi.fn(),
  messageProps: vi.fn(),
}));

vi.mock("~/features/measurement-flow/utils/process-scan/process-scan", () => ({
  applyMacro,
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
vi.mock("~/shared/ui/measurement/key-value", () => ({
  KeyValue: ({ name, value }: { name: string; value: string | number }) => (
    <Text testID={`key-value-${name}`}>{String(value)}</Text>
  ),
}));
vi.mock("~/shared/ui/measurement/chart", () => ({
  Chart: (props: { name: string; values: number[] }) => {
    chartProps(props);
    return <Text testID={`chart-${props.name}`}>{props.values.join(",")}</Text>;
  },
}));
vi.mock("./components/macro-messages", () => ({
  MacroMessages: (props: { messages: unknown[] }) => {
    messageProps(props);
    return <Text testID="macro-messages">{JSON.stringify(props.messages)}</Text>;
  },
}));

function renderResult(props: React.ComponentProps<typeof MeasurementResult>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MeasurementResult {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  applyMacro.mockReset();
  chartProps.mockClear();
  messageProps.mockClear();
});

describe("MeasurementResult once-per-measurement output", () => {
  it("renders, messages, charts, and forwards exactly one macro output", async () => {
    const rawMeasurement = { sample: [{ phi2: 0.8 }, { phi2: 0.2 }] };
    const macro = { code: "encoded", language: "javascript" };
    const output = {
      chlorophyll: 42,
      trace: [1, 2, 3],
      messages: { warning: ["Only the first measurement was processed"] },
    };
    const onProcessed = vi.fn();
    applyMacro.mockResolvedValue([output]);

    renderResult({ rawMeasurement, macro, onProcessed });

    await waitFor(() => expect(onProcessed).toHaveBeenCalledWith([output]));
    expect(onProcessed).toHaveBeenCalledTimes(1);
    expect(applyMacro).toHaveBeenCalledTimes(1);
    expect(applyMacro).toHaveBeenCalledWith(rawMeasurement, macro, {});
    expect(screen.getByTestId("key-value-chlorophyll").props.children).toBe("42");
    expect(screen.getByTestId("chart-trace").props.children).toBe("1,2,3");
    expect(chartProps).toHaveBeenCalledTimes(1);
    expect(chartProps).toHaveBeenCalledWith({ name: "trace", values: [1, 2, 3] });
    expect(messageProps).toHaveBeenCalledTimes(1);
    expect(messageProps).toHaveBeenCalledWith({ messages: [output.messages] });
  });

  it("renders one per-measurement failure and never calls onProcessed", async () => {
    const onProcessed = vi.fn();
    applyMacro.mockRejectedValue(new Error("Macro input rejected: empty-envelope"));

    renderResult({
      rawMeasurement: { sample: [] },
      macro: { code: "encoded", language: "javascript" },
      onProcessed,
    });

    await waitFor(() =>
      expect(
        screen.getByText(
          "measurementFlow:result.processingError: Macro input rejected: empty-envelope",
        ),
      ).toBeTruthy(),
    );
    expect(onProcessed).not.toHaveBeenCalled();
    expect(chartProps).not.toHaveBeenCalled();
    expect(messageProps).not.toHaveBeenCalled();
  });

  it("surfaces an upstream normalization failure without invoking the macro", async () => {
    const inputError = new Error("Output data normalization failed: empty-envelope");
    inputError.name = "OutputDataNormalizationError";
    const onProcessed = vi.fn();

    renderResult({
      rawMeasurement: { phi2: 0.8 },
      macro: { code: "encoded", language: "javascript" },
      inputError,
      onProcessed,
    });

    await waitFor(() =>
      expect(
        screen.getByText(
          "measurementFlow:result.processingError: Output data normalization failed: empty-envelope",
        ),
      ).toBeTruthy(),
    );
    expect(applyMacro).not.toHaveBeenCalled();
    expect(onProcessed).not.toHaveBeenCalled();
  });
});
