import { cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OfflineBanner } from "~/features/auth/components/offline-banner";
import common from "~/shared/i18n/locales/en-US/common.json";

vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, unknown> = common;
      return labels[key] ?? key;
    },
  }),
}));
vi.mock("@expo/vector-icons/MaterialIcons", () => ({ default: () => null }));

afterEach(cleanup);

describe("OfflineBanner", () => {
  it.each([undefined, true])("renders nothing while online is %j", (online) => {
    render(<OfflineBanner online={online} checking={false} onRetry={vi.fn()} />);
    expect(screen.queryByText(common.serverUnreachable)).toBeNull();
  });

  it("offers a retry when the server is unreachable", () => {
    const onRetry = vi.fn();
    render(<OfflineBanner online={false} checking={false} onRetry={onRetry} />);

    expect(screen.queryByText(common.checkingConnection)).toBeNull();
    fireEvent.press(screen.getByText(common.retry));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows progress while a retry runs", () => {
    render(<OfflineBanner online={false} checking onRetry={vi.fn()} />);

    expect(screen.getByText(common.checkingConnection)).toBeTruthy();
    expect(screen.getByLabelText(common.checkingConnection).props.accessibilityState).toEqual(
      expect.objectContaining({ busy: true }),
    );
  });
});
