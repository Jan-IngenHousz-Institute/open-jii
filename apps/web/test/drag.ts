/**
 * Drag/drop event helpers for jsdom.
 *
 * jsdom's `new DragEvent(type, { clientX, clientY })` silently drops the
 * MouseEventInit fields, and never synthesises `DataTransfer`. Tests that
 * exercise drag handlers need both. These helpers fire a plain `Event` and
 * `defineProperty` the bits the handler actually reads onto it, so React's
 * `SyntheticEvent` surfaces them.
 */
import { fireEvent } from "@testing-library/react";

interface DragInit {
  clientX?: number;
  clientY?: number;
  relatedTarget?: Node | null;
}

function minimalDataTransfer() {
  return {
    effectAllowed: "none",
    dropEffect: "none",
    setData: () => undefined,
    getData: () => "",
  };
}

function fire(target: Element, type: string, init: DragInit) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  if (init.clientX !== undefined) {
    Object.defineProperty(event, "clientX", { value: init.clientX });
  }
  if (init.clientY !== undefined) {
    Object.defineProperty(event, "clientY", { value: init.clientY });
  }
  if ("relatedTarget" in init) {
    Object.defineProperty(event, "relatedTarget", { value: init.relatedTarget });
  }
  Object.defineProperty(event, "dataTransfer", { value: minimalDataTransfer() });
  fireEvent(target, event);
}

export const fireDrag = {
  start: (target: Element, init: DragInit = {}) => fire(target, "dragstart", init),
  over: (target: Element, init: DragInit = {}) => fire(target, "dragover", init),
  drop: (target: Element, init: DragInit = {}) => fire(target, "drop", init),
  leave: (target: Element, init: DragInit = {}) => fire(target, "dragleave", init),
  end: (target: Element, init: DragInit = {}) => fire(target, "dragend", init),
};

/**
 * Stubs getBoundingClientRect on an element. jsdom returns zeros for every
 * rect, so any test whose component math depends on rect.top/.height/.width
 * needs to install a real value first.
 */
export function stubBoundingRect(
  el: Element,
  rect: { top?: number; left?: number; width?: number; height?: number } = {},
) {
  const top = rect.top ?? 0;
  const left = rect.left ?? 0;
  const width = rect.width ?? 0;
  const height = rect.height ?? 0;
  Object.defineProperty(el, "getBoundingClientRect", {
    configurable: true,
    value: () =>
      ({
        top,
        bottom: top + height,
        left,
        right: left + width,
        width,
        height,
        x: left,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect,
  });
}
