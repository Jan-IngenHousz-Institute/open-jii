import { act, render, screen } from "@/test/test-utils";
import { formatShortDate } from "@/util/date";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocalTime } from "../local-time";

const LATE_EVENING = "2026-10-09T03:00:00.000Z";

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

describe("LocalTime", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the UTC date on the server", () => {
    expect(renderToString(<LocalTime value={LATE_EVENING} locale="en-US" />)).toBe("Oct 9, 2026");
  });

  it("renders the reader's date on the client", () => {
    render(<LocalTime value={LATE_EVENING} locale="en-US" />);

    expect(screen.getByText(formatShortDate(LATE_EVENING, "en-US"))).toBeInTheDocument();
  });

  it("renders a relative time on the client when asked", () => {
    render(<LocalTime value={hoursAgo(3)} locale="en-US" isRelative />);

    expect(screen.getByText("3 hours ago")).toBeInTheDocument();
  });

  it("hydrates the server's text without a mismatch, then shows the reader's", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const value = hoursAgo(3);
    const container = document.createElement("div");
    container.innerHTML = renderToString(<LocalTime value={value} locale="en-US" isRelative />);
    const onRecoverableError = vi.fn();

    // The browser hydrates later than the server rendered, by a whole hour here.
    vi.setSystemTime(Date.now() + 3_600_000);
    act(() => {
      hydrateRoot(container, <LocalTime value={value} locale="en-US" isRelative />, {
        onRecoverableError,
      });
    });

    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(container.textContent).toBe("4 hours ago");
  });
});
