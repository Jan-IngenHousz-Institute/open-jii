import { act } from "@testing-library/react";
import React from "react";
import { describe, it, expect } from "vitest";
import { renderIntoElement } from "~/util/reactUtil";

describe("renderIntoElement", () => {
  it("renders a React component into the given element", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);

    act(() => {
      renderIntoElement(element, <span data-testid="test-span">Hello</span>);
    });

    expect(element.querySelector('[data-testid="test-span"]')).not.toBeNull();
    expect(element.textContent).toBe("Hello");

    document.body.removeChild(element);
  });
});
