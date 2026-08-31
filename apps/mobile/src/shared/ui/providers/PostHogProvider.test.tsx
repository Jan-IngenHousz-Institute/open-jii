import { act, render } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEnvironmentStore } from "~/shared/stores/environment-store";

import { PostHogProvider } from "./PostHogProvider";

const { getPostHogClient, rnProvider } = vi.hoisted(() => ({
  getPostHogClient: vi.fn(),
  rnProvider: vi.fn((_props: { children: React.ReactNode }) => null),
}));

vi.mock("~/shared/observability/posthog", () => ({
  getPostHogClient: () => getPostHogClient(),
}));
vi.mock("posthog-react-native", () => ({
  PostHogProvider: (props: { children: React.ReactNode }) => rnProvider(props),
}));

function renderProvider() {
  return render(
    <PostHogProvider>
      <Text>app</Text>
    </PostHogProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getPostHogClient.mockReturnValue({});
  useEnvironmentStore.setState({ environment: "prod", isLoaded: true });
});

describe("PostHogProvider", () => {
  it("initializes the client once the environment store is ready", () => {
    renderProvider();

    expect(getPostHogClient).toHaveBeenCalledTimes(1);
    expect(rnProvider).toHaveBeenCalled();
  });

  it("waits for store rehydration instead of failing the session", () => {
    useEnvironmentStore.setState({ environment: undefined, isLoaded: false });
    getPostHogClient.mockImplementation(() => {
      throw new Error("Attempted to read environment before storage rehydration completed");
    });

    renderProvider();
    expect(getPostHogClient).not.toHaveBeenCalled();
    expect(rnProvider).not.toHaveBeenCalled();

    getPostHogClient.mockReturnValue({});
    act(() => {
      useEnvironmentStore.setState({ environment: "prod", isLoaded: true });
    });

    expect(getPostHogClient).toHaveBeenCalledTimes(1);
    expect(rnProvider).toHaveBeenCalled();
  });

  it("keeps children mounted when initialization fails", () => {
    getPostHogClient.mockImplementation(() => {
      throw new Error("Env variable POSTHOG_API_KEY is required");
    });

    const { getByText } = renderProvider();

    expect(getByText("app")).toBeTruthy();
    expect(rnProvider).not.toHaveBeenCalled();
  });
});
