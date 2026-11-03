import { act, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithTranslations } from "~/test/render-status";

import ErrorPage from "../error";

beforeEach(() => {
  vi.useFakeTimers();
});

describe("the error page", () => {
  it("shows the unavailable card inside the page's header and footer", () => {
    renderWithTranslations(<ErrorPage reset={() => undefined} />);

    expect(screen.getByRole("heading", { level: 1, name: "Platform status" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Status unavailable" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "openJII home page" })).toBeInTheDocument();
    expect(screen.getByText(/should stay reachable when the platform is down/)).toBeInTheDocument();
  });

  it("tries the page again after a minute, as the card says it does", async () => {
    const reset = vi.fn();
    renderWithTranslations(<ErrorPage reset={reset} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_999);
    });
    expect(reset).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("stops waiting when it goes away", () => {
    const { unmount } = renderWithTranslations(<ErrorPage reset={() => undefined} />);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
