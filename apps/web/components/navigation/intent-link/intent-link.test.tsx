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
  it("upgrades to a full prefetch once the pointer rests on it, keeping the caller's handler", () => {
    const onMouseEnter = vi.fn();
    render(
      <IntentLink href="/en-US/platform/experiments/1" onMouseEnter={onMouseEnter}>
        Experiment
      </IntentLink>,
    );
    expect(link.prefetch.at(-1)).toBeNull();

    fireEvent.mouseEnter(screen.getByRole("link", { name: "Experiment" }));

    expect(link.prefetch.at(-1)).toBe(true);
    expect(onMouseEnter).toHaveBeenCalledOnce();
  });

  it("upgrades on touch start", () => {
    render(<IntentLink href="/en-US/platform/workbooks/1">Workbook</IntentLink>);

    fireEvent.touchStart(screen.getByRole("link", { name: "Workbook" }));

    expect(link.prefetch.at(-1)).toBe(true);
  });
});
