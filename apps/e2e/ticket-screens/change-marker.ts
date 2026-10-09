import type { Locator, Page } from "@playwright/test";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where the tag sits, chosen so it never covers the thing it points at. */
export type TagPlacement = "above" | "below" | "inside-right" | "outside-left";

const MARK_COLOR = "#EA580C";

/**
 * Outlines the part of a page a ticket changes and labels it with a short tag, then gives the
 * crop around it. The overlay sits on top of the page; the product itself is untouched.
 */
export class ChangeMarker {
  constructor(private readonly page: Page) {}

  async mark(
    targets: Locator | readonly Locator[],
    label = "New",
    placement: TagPlacement = "above",
  ): Promise<void> {
    const box = await this.union(Array.isArray(targets) ? targets : [targets], 0);
    await this.page.evaluate(
      ({ box, label, color, placement }) => {
        const pad = 4;
        const frame = document.createElement("div");
        Object.assign(frame.style, {
          position: "fixed",
          left: `${box.x - pad}px`,
          top: `${box.y - pad}px`,
          width: `${box.width + pad * 2}px`,
          height: `${box.height + pad * 2}px`,
          border: `2.5px solid ${color}`,
          borderRadius: "8px",
          pointerEvents: "none",
          zIndex: "2147483646",
        });

        const isBeside = placement === "inside-right" || placement === "outside-left";
        const top = isBeside
          ? box.y + box.height / 2 - 11
          : placement === "below"
            ? box.y + box.height + pad + 4
            : box.y - pad - 22;
        const right =
          placement === "inside-right"
            ? `${window.innerWidth - (box.x + box.width) + 6}px`
            : placement === "outside-left"
              ? `${window.innerWidth - box.x + pad + 6}px`
              : "auto";

        const tag = document.createElement("div");
        tag.textContent = label;
        Object.assign(tag.style, {
          position: "fixed",
          left: isBeside ? "auto" : `${box.x - pad}px`,
          right,
          top: `${top}px`,
          background: color,
          color: "white",
          font: "600 11px/1 Inter, system-ui, sans-serif",
          padding: "5px 7px",
          borderRadius: "5px",
          pointerEvents: "none",
          zIndex: "2147483647",
          whiteSpace: "nowrap",
        });
        document.body.append(frame, tag);
      },
      { box, label, color: MARK_COLOR, placement },
    );
  }

  /** The crop: the targets plus a margin of context, kept inside the viewport. */
  async frame(targets: readonly Locator[], margin = 32): Promise<Box> {
    const box = await this.union(targets, margin);
    const viewport = this.page.viewportSize() ?? { width: 1440, height: 900 };
    const left = Math.max(0, box.x);
    // Room above for a tag placed over the top target.
    const top = Math.max(0, box.y - 24);
    const right = Math.min(viewport.width, box.x + box.width);
    const bottom = Math.min(viewport.height, box.y + box.height);
    return { x: left, y: top, width: right - left, height: bottom - top };
  }

  private async union(targets: readonly Locator[], margin: number): Promise<Box> {
    const boxes = await Promise.all(targets.map((target) => target.boundingBox()));
    const found = boxes.filter((box): box is Box => box !== null);
    if (found.length === 0) throw new Error("None of the targets is on the page");

    const left = Math.min(...found.map((box) => box.x)) - margin;
    const top = Math.min(...found.map((box) => box.y)) - margin;
    const right = Math.max(...found.map((box) => box.x + box.width)) + margin;
    const bottom = Math.max(...found.map((box) => box.y + box.height)) + margin;
    return { x: left, y: top, width: right - left, height: bottom - top };
  }
}
