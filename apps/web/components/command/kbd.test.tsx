import { render, screen } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { CommandKHint, Kbd, KbdSequence } from "./kbd";

describe("Kbd", () => {
  it("renders its children inside a <kbd>", () => {
    render(<Kbd>⌘</Kbd>);
    const el = screen.getByText("⌘");
    expect(el.tagName).toBe("KBD");
  });
});

describe("KbdSequence", () => {
  it("renders one Kbd per key", () => {
    render(<KbdSequence keys={["G", "E"]} />);
    expect(screen.getByText("G").tagName).toBe("KBD");
    expect(screen.getByText("E").tagName).toBe("KBD");
  });
});

describe("CommandKHint", () => {
  it("renders the K key alongside a modifier glyph", () => {
    render(<CommandKHint />);
    expect(screen.getByText("K")).toBeInTheDocument();
    // Modifier resolves to ⌘ (SSR fallback) or Ctrl (after effect) — either is fine.
    expect(screen.getByText(/⌘|Ctrl/)).toBeInTheDocument();
  });
});
