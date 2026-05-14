import { fireEvent, render } from "@testing-library/react";
import React, { useRef } from "react";
import { describe, expect, it, vi } from "vitest";

import { useClickOutside } from "../use-click-outside";

function Probe({
  onOutside,
  enabled,
  onEscape,
  ignoreSelectors,
}: {
  onOutside: () => void;
  enabled?: boolean;
  onEscape?: () => void;
  ignoreSelectors?: string[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onOutside, { enabled, onEscape, ignoreSelectors });
  return (
    <>
      <div ref={ref} data-testid="inside">
        <button data-testid="inside-button">inside</button>
      </div>
      <div data-testid="outside">
        <button data-testid="outside-button">outside</button>
      </div>
      <div data-radix-popover-content data-testid="radix-popover">
        <button data-testid="radix-button">radix</button>
      </div>
    </>
  );
}

describe("useClickOutside", () => {
  it("fires handler on pointerdown outside the ref", () => {
    const onOutside = vi.fn();
    const { getByTestId } = render(<Probe onOutside={onOutside} />);
    fireEvent.pointerDown(getByTestId("outside-button"));
    expect(onOutside).toHaveBeenCalledTimes(1);
  });

  it("does not fire when pointerdown is inside the ref", () => {
    const onOutside = vi.fn();
    const { getByTestId } = render(<Probe onOutside={onOutside} />);
    fireEvent.pointerDown(getByTestId("inside-button"));
    expect(onOutside).not.toHaveBeenCalled();
  });

  it("ignores pointerdown inside a Radix popover portal by default", () => {
    const onOutside = vi.fn();
    const { getByTestId } = render(<Probe onOutside={onOutside} />);
    fireEvent.pointerDown(getByTestId("radix-button"));
    expect(onOutside).not.toHaveBeenCalled();
  });

  it("detaches the listener when enabled is false", () => {
    const onOutside = vi.fn();
    const { getByTestId } = render(<Probe onOutside={onOutside} enabled={false} />);
    fireEvent.pointerDown(getByTestId("outside-button"));
    expect(onOutside).not.toHaveBeenCalled();
  });

  it("fires onEscape when Escape is pressed", () => {
    const onOutside = vi.fn();
    const onEscape = vi.fn();
    render(<Probe onOutside={onOutside} onEscape={onEscape} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(onOutside).not.toHaveBeenCalled();
  });

  it("honours additional ignoreSelectors", () => {
    const onOutside = vi.fn();
    const { container } = render(
      <>
        <Probe onOutside={onOutside} ignoreSelectors={["[data-custom-portal]"]} />
        <div data-custom-portal>
          <button data-testid="custom-portal-button">portal</button>
        </div>
      </>,
    );
    const customButton = container.querySelector(
      '[data-testid="custom-portal-button"]',
    ) as HTMLElement;
    fireEvent.pointerDown(customButton);
    expect(onOutside).not.toHaveBeenCalled();
  });
});
