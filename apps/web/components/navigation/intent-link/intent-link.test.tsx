import { fireEvent, render, screen } from "@/test/test-utils";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";

import { IntentLink } from "./intent-link";

const link = vi.hoisted(() => {
  const prefetch: unknown[] = [];
  return { prefetch };
});

vi.mock("next/link", () => ({
  default: ({ prefetch, href, ...props }: ComponentProps<"a"> & { prefetch?: unknown }) => {
    link.prefetch.push(prefetch);
    return <a href={String(href)} {...props} />;
  },
}));

describe("IntentLink", () => {
  it("prefetches nothing while merely visible, then the whole page once the pointer rests on it", () => {
    const onMouseEnter = vi.fn();
    render(
      <IntentLink href="/en-US/platform/experiments/1" onMouseEnter={onMouseEnter}>
        Experiment
      </IntentLink>,
    );
    expect(link.prefetch.at(-1)).toBe(false);

    fireEvent.mouseEnter(screen.getByRole("link", { name: "Experiment" }));

    expect(link.prefetch.at(-1)).toBe(true);
    expect(onMouseEnter).toHaveBeenCalledOnce();
  });

  it("upgrades on touch start", () => {
    render(<IntentLink href="/en-US/platform/workbooks/1">Workbook</IntentLink>);

    fireEvent.touchStart(screen.getByRole("link", { name: "Workbook" }));

    expect(link.prefetch.at(-1)).toBe(true);
  });

  it("upgrades on keyboard focus", () => {
    render(<IntentLink href="/en-US/platform/protocols/1">Protocol</IntentLink>);

    fireEvent.focus(screen.getByRole("link", { name: "Protocol" }));

    expect(link.prefetch.at(-1)).toBe(true);
  });

  it("keeps the loading-shell prefetch while visible when asked, then fetches the whole page", () => {
    render(
      <IntentLink prefetchWhileVisible href="/en-US/platform/experiments">
        Experiments
      </IntentLink>,
    );
    expect(link.prefetch.at(-1)).toBeNull();

    fireEvent.mouseEnter(screen.getByRole("link", { name: "Experiments" }));

    expect(link.prefetch.at(-1)).toBe(true);
  });
});
