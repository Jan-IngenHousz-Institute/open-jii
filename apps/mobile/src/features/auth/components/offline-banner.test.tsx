import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfflineBanner } from "~/features/auth/components/offline-banner";
import english from "~/shared/i18n/locales/en-US/common.json";
import dutch from "~/shared/i18n/locales/nl-NL/common.json";

const locale = vi.hoisted(() => ({ value: "en-US" }));
vi.mock("~/shared/i18n", async () => {
  const { createInstance } = await import("i18next");
  const { default: english } = await import("~/shared/i18n/locales/en-US/common.json");
  const { default: dutch } = await import("~/shared/i18n/locales/nl-NL/common.json");
  const i18n = createInstance();
  await i18n.init({
    defaultNS: "common",
    resources: { "en-US": { common: english }, "nl-NL": { common: dutch } },
  });
  return {
    useTranslation: () => ({
      t: (key: string, options?: { context?: string }) =>
        i18n.t(key, { ...options, lng: locale.value }),
    }),
  };
});
vi.mock("@expo/vector-icons/MaterialIcons", () => ({ default: () => null }));

afterEach(cleanup);

describe.each([
  ["en-US", english],
  ["nl-NL", dutch],
] as const)("OfflineBanner in %s", (language, common) => {
  beforeEach(() => {
    locale.value = language;
  });
  it.each([undefined, true])("renders nothing while online is %j", (online) => {
    render(<OfflineBanner online={online} checking={false} onRetry={vi.fn()} />);
    expect(screen.queryByText(common.serverUnreachable)).toBeNull();
  });

  it("offers a retry when the server is unreachable", () => {
    const onRetry = vi.fn();
    render(<OfflineBanner online={false} checking={false} onRetry={onRetry} />);

    expect(screen.queryByText(common.checkingConnection)).toBeNull();
    expect(screen.getByLabelText(common.retry).props.accessibilityState).toEqual(
      expect.objectContaining({ busy: false }),
    );
    expect(screen.getByRole("button").props.accessibilityLabel).toBe(
      screen.getByText(common.retry).props.children,
    );
    fireEvent.press(screen.getByText(common.retry));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows progress while a retry runs", () => {
    render(<OfflineBanner online={false} checking onRetry={vi.fn()} />);

    expect(screen.getByRole("button").props.accessibilityLabel).toBe(
      screen.getByText(common.checkingConnection).props.children,
    );
    expect(screen.getByLabelText(common.checkingConnection).props.accessibilityState).toEqual(
      expect.objectContaining({ busy: true }),
    );
  });
});
