import { render, screen } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PageForceUpdateFieldsFragment } from "@repo/cms/lib/__generated/sdk";

import { ForceUpdateGate } from "./force-update-gate";

const { mockGateResult } = vi.hoisted(() => ({
  mockGateResult: {
    value: {
      status: "allowed",
      gated: false,
      gate: null,
    } as any,
  },
}));

vi.mock("~/features/force-update/hooks/use-force-update-gate", () => ({
  useForceUpdateGate: () => mockGateResult.value,
}));

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("~/shared/ui/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({ brand: "#006adc" }),
}));

vi.mock("~/shared/ui/ctf-rich-text", () => ({
  CtfRichText: () => null,
}));

vi.mock("lucide-react-native", () => ({
  ArrowUpCircle: () => null,
  ArrowRight: () => null,
}));

vi.mock("expo-application", () => ({
  nativeApplicationVersion: "1.0.0",
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

function makeGate(): PageForceUpdateFieldsFragment {
  return {
    __typename: "PageForceUpdate",
    sys: { __typename: "Sys", id: "force-update-1" },
    internalName: "force-update",
    title: "Please update",
    body: null,
    updateCta: null,
    minVersion: "2.0.0",
    effectiveAt: null,
    active: true,
  };
}

beforeEach(() => {
  mockGateResult.value = {
    status: "allowed",
    gated: false,
    gate: null,
  };
});

describe("ForceUpdateGate", () => {
  it("renders nothing while the gate status is checking", () => {
    mockGateResult.value = {
      status: "checking",
      gated: false,
      gate: null,
    };

    render(
      <ForceUpdateGate>
        <Text>App content</Text>
      </ForceUpdateGate>,
    );

    expect(screen.queryByText("App content")).toBeNull();
  });

  it("renders children when the app is allowed", () => {
    render(
      <ForceUpdateGate>
        <Text>App content</Text>
      </ForceUpdateGate>,
    );

    expect(screen.getByText("App content")).toBeTruthy();
  });

  it("renders the force-update screen when gated", () => {
    mockGateResult.value = {
      status: "gated",
      gated: true,
      gate: makeGate(),
    };

    render(
      <ForceUpdateGate>
        <Text>App content</Text>
      </ForceUpdateGate>,
    );

    expect(screen.queryByText("App content")).toBeNull();
    expect(screen.getByText("Please update")).toBeTruthy();
  });
});
