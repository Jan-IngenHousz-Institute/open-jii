import type { Config, ModeBarButton, ModeBarButtonAny, PlotlyHTMLElement } from "plotly.js";

import { toast } from "../../hooks/use-toast";

const EXPORT_BUTTON = "downloadBrandedPng";
// The light mark is dark teal, which disappears on a dark export.
const LOGO_LIGHT = "/openJII_logo_RGB_horizontal_green_yellow_trimmed.svg";
const LOGO_DARK = "/openJII_logo_RGB_horizontal_yellow_transparentBG.png";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load the chart export image."));
    image.src = src;
  });
}

export async function downloadBrandedPng(
  graph: PlotlyHTMLElement,
  options: Config["toImageButtonOptions"] = {},
): Promise<void> {
  const { Plotly } = await import("./plotly-runtime");
  const isDark = document.documentElement.classList.contains("dark");
  const [chart, logo] = await Promise.all([
    Plotly.toImage(graph, {
      format: "png",
      width: options.width ?? null,
      height: options.height ?? null,
      scale: options.scale ?? 1,
    }).then(loadImage),
    loadImage(isDark ? LOGO_DARK : LOGO_LIGHT),
  ]);

  const canvas = document.createElement("canvas");
  const logoWidth = Math.round(Math.min(chart.naturalWidth * 0.18, chart.naturalHeight * 0.4));
  const logoHeight = Math.round((logoWidth * logo.naturalHeight) / logo.naturalWidth);
  const padding = Math.max(1, Math.round(logoWidth * 0.1));
  canvas.width = chart.naturalWidth;
  canvas.height = chart.naturalHeight + logoHeight + padding * 2;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image export is unavailable in this browser.");

  // The footer carries the chart's own background, sampled from its corner, so
  // it continues the export instead of banding it white on a dark theme.
  context.drawImage(chart, 0, 0);
  const [r = 255, g = 255, b = 255, a = 255] = context.getImageData(0, 0, 1, 1).data;
  context.fillStyle = `rgba(${r},${g},${b},${a / 255})`;
  context.fillRect(0, chart.naturalHeight, canvas.width, logoHeight + padding * 2);
  context.drawImage(
    logo,
    canvas.width - logoWidth - padding,
    chart.naturalHeight + padding,
    logoWidth,
    logoHeight,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error("Could not encode the chart as a PNG."));
    }, "image/png");
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${options.filename || "plot"}.png`;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Give the browser time to consume the object URL before releasing it.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export function withBrandedPngExport(config: Partial<Config>): Partial<Config> {
  const options = config.toImageButtonOptions;
  const isBranded = (item: ModeBarButtonAny) =>
    typeof item !== "string" && item.name === EXPORT_BUTTON;
  if (options?.format && options.format !== "png") {
    if (config.modeBarButtons && config.modeBarButtons.length > 0) {
      return {
        ...config,
        modeBarButtons: config.modeBarButtons.map((group) =>
          group.map((item) => (isBranded(item) ? "toImage" : item)),
        ),
      };
    }
    if (!config.modeBarButtonsToAdd?.some(isBranded)) return config;
    return {
      ...config,
      modeBarButtonsToAdd: config.modeBarButtonsToAdd.filter((item) => !isBranded(item)),
      modeBarButtonsToRemove: config.modeBarButtonsToRemove?.filter((item) => item !== "toImage"),
    };
  }

  let exporting = false;
  const button: ModeBarButton = {
    name: EXPORT_BUTTON,
    title: "Download plot as a PNG",
    // Plotly camera icon, kept inline to avoid loading Plotly until export.
    icon: {
      width: 1000,
      height: 1000,
      path: "m500 450c-83 0-150-67-150-150 0-83 67-150 150-150 83 0 150 67 150 150 0 83-67 150-150 150z m400 150h-120c-16 0-34 13-39 29l-31 93c-6 15-23 28-40 28h-340c-16 0-34-13-39-28l-31-94c-6-15-23-28-40-28h-120c-55 0-100-45-100-100v-450c0-55 45-100 100-100h800c55 0 100 45 100 100v450c0 55-45 100-100 100z m-400-550c-138 0-250 112-250 250 0 138 112 250 250 250 138 0 250-112 250-250 0-138-112-250-250-250z m365 380c-19 0-35 16-35 35 0 19 16 35 35 35 19 0 35-16 35-35 0-19-16-35-35-35z",
      transform: "matrix(1 0 0 -1 0 850)",
    },
    click: async (graph) => {
      if (exporting) return;
      exporting = true;
      try {
        await downloadBrandedPng(graph, options);
      } catch {
        toast({
          variant: "destructive",
          description: "Could not download the chart image. Please try again.",
        });
      } finally {
        exporting = false;
      }
    },
  };
  const replace = (item: ModeBarButtonAny) =>
    item === "toImage" || (typeof item !== "string" && item.name === EXPORT_BUTTON) ? button : item;

  if (config.modeBarButtons && config.modeBarButtons.length > 0) {
    return { ...config, modeBarButtons: config.modeBarButtons.map((group) => group.map(replace)) };
  }

  const additions = config.modeBarButtonsToAdd ?? [];
  const hasExport = additions.some(isBranded);
  if (config.modeBarButtonsToRemove?.includes("toImage") && !hasExport) return config;

  return {
    ...config,
    modeBarButtonsToRemove: Array.from(
      new Set([...(config.modeBarButtonsToRemove ?? []), "toImage"]),
    ),
    modeBarButtonsToAdd: hasExport ? additions.map(replace) : [...additions, button],
  };
}
