import type { ModeBarButton, PlotlyHTMLElement } from "plotly.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "../../../hooks/use-toast";
import { downloadBrandedPng, withBrandedPngExport } from "../../charts/png-export";
import { createPlotlyConfig } from "../../charts/utils";

const { toImage } = vi.hoisted(() => ({ toImage: vi.fn() }));
vi.mock("plotly.js/dist/plotly", () => ({ toImage }));
vi.mock("../../../hooks/use-toast", () => ({ toast: vi.fn() }));

const graph = document.createElement("div") as unknown as PlotlyHTMLElement;
const drawImage = vi.fn();
const fillRect = vi.fn();
let canvas: HTMLCanvasElement;
let downloaded: { name: string; href: string } | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  downloaded = undefined;
  toImage.mockResolvedValue("data:image/png;base64,chart");
  vi.stubGlobal(
    "Image",
    class {
      naturalWidth = 2400;
      naturalHeight = 1600;
      onload?: () => void;
      set src(value: string) {
        if (value.endsWith(".svg")) {
          this.naturalWidth = 414;
          this.naturalHeight = 122;
        }
        queueMicrotask(() => this.onload?.());
      }
    },
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    canvas = this;
    return { drawImage, fillRect, fillStyle: "" } as unknown as CanvasRenderingContext2D;
  });
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
    callback(new Blob(["png"], { type: "image/png" }));
  });
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = vi.fn(() => "blob:chart");
      static revokeObjectURL = vi.fn();
    },
  );
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloaded = { name: this.download, href: this.href };
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("branded PNG export", () => {
  it("preserves the chart pixels and adds a scaled logo in a separate footer", async () => {
    await downloadBrandedPng(graph, {
      width: 1200,
      height: 800,
      scale: 2,
      filename: "field-trial",
    });

    expect(toImage).toHaveBeenCalledWith(graph, {
      format: "png",
      width: 1200,
      height: 800,
      scale: 2,
    });
    expect(canvas.width).toBe(2400);
    expect(canvas.height).toBe(1813);
    expect(drawImage).toHaveBeenNthCalledWith(1, expect.anything(), 0, 0);
    expect(fillRect).toHaveBeenCalledWith(0, 1600, 2400, 213);
    expect(drawImage).toHaveBeenNthCalledWith(2, expect.anything(), 1925, 1643, 432, 127);
    expect(downloaded).toEqual({ name: "field-trial.png", href: "blob:chart" });
    expect(document.querySelector("a[download]")).toBeNull();
  });

  it("uses the graph dimensions when none are configured", async () => {
    await downloadBrandedPng(graph);
    expect(toImage).toHaveBeenCalledWith(graph, {
      format: "png",
      width: null,
      height: null,
      scale: 1,
    });
    expect(downloaded?.name).toBe("plot.png");
  });

  it("rejects a failed PNG encoding without starting a download", async () => {
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => callback(null));
    await expect(downloadBrandedPng(graph)).rejects.toThrow("Could not encode");
    expect(downloaded).toBeUndefined();
  });

  it("reports export failure and permits retry", async () => {
    const config = withBrandedPngExport({ toImageButtonOptions: { format: "png" } });
    const button = config.modeBarButtonsToAdd?.[0] as ModeBarButton;
    toImage.mockRejectedValueOnce(new Error("snapshot failed"));
    await button.click(graph, new MouseEvent("click"));
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    expect(downloaded).toBeUndefined();
    await button.click(graph, new MouseEvent("click"));
    expect(downloaded?.name).toBe("plot.png");
  });

  it("wires the shared chart config once and preserves other modebar controls", () => {
    const custom: ModeBarButton = { name: "custom", title: "Custom", icon: "", click: vi.fn() };
    const config = createPlotlyConfig({ downloadFilename: "measurements" });
    const twice = withBrandedPngExport({
      ...config,
      modeBarButtonsToAdd: [...config.modeBarButtonsToAdd!, custom],
    });
    expect(twice.modeBarButtonsToRemove).toContain("toImage");
    expect(twice.modeBarButtonsToAdd).toHaveLength(2);
    expect(twice.modeBarButtonsToAdd?.[1]).toBe(custom);
    expect(twice.toImageButtonOptions?.filename).toBe("measurements");
  });

  it("respects a removed download button and custom button groups", () => {
    const removed = { modeBarButtonsToRemove: ["toImage" as const] };
    expect(withBrandedPngExport(removed)).toBe(removed);
    const config = withBrandedPngExport({ modeBarButtons: [["zoom2d", "toImage"], ["pan2d"]] });
    expect(config.modeBarButtons).toEqual([
      ["zoom2d", expect.objectContaining({ name: "downloadBrandedPng" })],
      ["pan2d"],
    ]);
  });

  it("keeps non-PNG exports native, including a format override after shared config creation", () => {
    const svg = { toImageButtonOptions: { format: "svg" as const } };
    expect(withBrandedPngExport(svg)).toBe(svg);
    const config = withBrandedPngExport({ ...createPlotlyConfig({}), ...svg });
    expect(config.modeBarButtonsToAdd).toEqual([]);
    expect(config.modeBarButtonsToRemove).not.toContain("toImage");
  });
});
