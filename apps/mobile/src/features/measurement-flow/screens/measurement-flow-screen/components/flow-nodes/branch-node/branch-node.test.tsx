import { render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FlowNode } from "~/shared/measurements/flow-node";

import { BranchNode } from "./branch-node";

const { evaluateAndRoute, errorStateProps } = vi.hoisted(() => ({
  evaluateAndRoute: vi.fn(),
  errorStateProps: vi.fn(),
}));

vi.mock("../utils/evaluate-and-route", () => ({ evaluateAndRoute }));
vi.mock("../measurement-node/components/error-state", () => ({
  ErrorState: (props: { error: Error }) => {
    errorStateProps(props);
    return <Text testID="branch-routing-error">{props.error.message}</Text>;
  },
}));
vi.mock("~/shared/ui/hooks/use-theme", () => ({
  useTheme: () => ({ colors: { brand: "#000000" } }),
}));

const NODE: FlowNode = {
  id: "b1",
  type: "branch",
  name: "Branch",
  content: {},
  isStart: false,
};

beforeEach(() => {
  evaluateAndRoute.mockReset();
  errorStateProps.mockClear();
});

describe("BranchNode routing failures", () => {
  it("renders the existing measurement error state for a controlled normalization failure", async () => {
    const error = new Error("Output data normalization failed: empty-envelope");
    error.name = "OutputDataNormalizationError";
    evaluateAndRoute.mockReturnValue(error);

    render(<BranchNode node={NODE} />);

    await waitFor(() => expect(screen.getByTestId("branch-routing-error")).toBeTruthy());
    expect(errorStateProps).toHaveBeenCalledWith({ error });
    expect(evaluateAndRoute).toHaveBeenCalledTimes(1);
  });
});
