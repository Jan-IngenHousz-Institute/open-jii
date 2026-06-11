export interface ColorscaleEntry {
  value: string;
  translationKey: string;
  colors: readonly string[];
  // Only set when a colorscale isn't in plotly.js's built-in names list
  // or needs non-uniform spacing.
  plotlyStops?: [number, string][];
  // Derived `linear-gradient(to right, ...)` for swatches.
  gradient: string;
}

interface RawColorscale {
  value: string;
  translationKey: string;
  colors: readonly string[];
  plotlyStops?: [number, string][];
}

const RAW_COLORSCALES: readonly RawColorscale[] = [
  {
    value: "Viridis",
    translationKey: "viridis",
    colors: [
      "#440154",
      "#48186a",
      "#472d7b",
      "#424086",
      "#3b528b",
      "#33638d",
      "#2c728e",
      "#26828e",
      "#21918c",
      "#1fa088",
      "#28ae80",
      "#3fbc73",
      "#5ec962",
      "#84d44b",
      "#addc30",
      "#d8e219",
      "#fde725",
    ],
  },
  {
    value: "Cividis",
    translationKey: "cividis",
    colors: [
      "rgb(0,32,76)",
      "rgb(0,42,102)",
      "rgb(0,52,110)",
      "rgb(39,63,108)",
      "rgb(60,74,107)",
      "rgb(76,85,107)",
      "rgb(91,95,109)",
      "rgb(104,106,112)",
      "rgb(117,117,117)",
      "rgb(131,129,120)",
      "rgb(146,140,120)",
      "rgb(161,152,118)",
      "rgb(176,165,114)",
      "rgb(192,177,109)",
      "rgb(209,191,102)",
      "rgb(225,204,92)",
      "rgb(243,219,79)",
      "rgb(255,233,69)",
    ],
  },
  {
    value: "Blues",
    translationKey: "blues",
    colors: [
      "rgb(5,10,172)",
      "rgb(40,60,190)",
      "rgb(70,100,245)",
      "rgb(90,120,245)",
      "rgb(106,137,247)",
      "rgb(220,220,220)",
    ],
  },
  {
    value: "Reds",
    translationKey: "reds",
    colors: ["rgb(220,220,220)", "rgb(245,195,157)", "rgb(245,160,105)", "rgb(178,10,28)"],
  },
  {
    value: "Greens",
    translationKey: "greens",
    colors: [
      "rgb(0,68,27)",
      "rgb(0,109,44)",
      "rgb(35,139,69)",
      "rgb(65,171,93)",
      "rgb(116,196,118)",
      "rgb(161,217,155)",
      "rgb(199,233,192)",
      "rgb(229,245,224)",
      "rgb(247,252,245)",
    ],
  },
  {
    value: "Greys",
    translationKey: "greys",
    colors: ["rgb(0,0,0)", "rgb(255,255,255)"],
  },
  {
    value: "YlGnBu",
    translationKey: "ylgnbu",
    colors: [
      "rgb(8,29,88)",
      "rgb(37,52,148)",
      "rgb(34,94,168)",
      "rgb(29,145,192)",
      "rgb(65,182,196)",
      "rgb(127,205,187)",
      "rgb(199,233,180)",
      "rgb(237,248,217)",
      "rgb(255,255,217)",
    ],
  },
  {
    value: "YlOrRd",
    translationKey: "ylord",
    colors: [
      "rgb(128,0,38)",
      "rgb(189,0,38)",
      "rgb(227,26,28)",
      "rgb(252,78,42)",
      "rgb(253,141,60)",
      "rgb(254,178,76)",
      "rgb(254,217,118)",
      "rgb(255,237,160)",
      "rgb(255,255,204)",
    ],
  },
  {
    value: "RdBu",
    translationKey: "rdbu",
    colors: [
      "rgb(5,10,172)",
      "rgb(106,137,247)",
      "rgb(190,190,190)",
      "rgb(220,170,132)",
      "rgb(230,145,90)",
      "rgb(178,10,28)",
    ],
  },
  {
    value: "Picnic",
    translationKey: "picnic",
    colors: [
      "rgb(0,0,255)",
      "rgb(51,153,255)",
      "rgb(102,204,255)",
      "rgb(153,204,255)",
      "rgb(204,204,255)",
      "rgb(255,255,255)",
      "rgb(255,204,255)",
      "rgb(255,153,255)",
      "rgb(255,102,204)",
      "rgb(255,102,102)",
      "rgb(255,0,0)",
    ],
  },
  {
    value: "Rainbow",
    translationKey: "rainbow",
    colors: [
      "rgb(150,0,90)",
      "rgb(0,0,200)",
      "rgb(0,25,255)",
      "rgb(0,152,255)",
      "rgb(44,255,150)",
      "rgb(151,255,0)",
      "rgb(255,234,0)",
      "rgb(255,111,0)",
      "rgb(255,0,0)",
    ],
  },
  {
    value: "Portland",
    translationKey: "portland",
    colors: [
      "rgb(12,51,131)",
      "rgb(10,136,186)",
      "rgb(242,211,56)",
      "rgb(242,143,56)",
      "rgb(217,30,30)",
    ],
  },
  {
    value: "Jet",
    translationKey: "jet",
    colors: [
      "rgb(0,0,131)",
      "rgb(0,60,170)",
      "rgb(5,255,255)",
      "rgb(255,255,0)",
      "rgb(250,0,0)",
      "rgb(128,0,0)",
    ],
  },
  {
    value: "Hot",
    translationKey: "hot",
    colors: ["rgb(0,0,0)", "rgb(230,0,0)", "rgb(255,210,0)", "rgb(255,255,255)"],
  },
  {
    value: "Blackbody",
    translationKey: "blackbody",
    colors: [
      "rgb(0,0,0)",
      "rgb(230,0,0)",
      "rgb(230,210,0)",
      "rgb(255,255,255)",
      "rgb(160,200,255)",
    ],
  },
  {
    value: "Earth",
    translationKey: "earth",
    colors: [
      "rgb(0,0,130)",
      "rgb(0,180,180)",
      "rgb(40,210,40)",
      "rgb(230,230,50)",
      "rgb(120,70,20)",
      "rgb(255,255,255)",
    ],
  },
  {
    value: "Electric",
    translationKey: "electric",
    colors: [
      "rgb(0,0,0)",
      "rgb(30,0,100)",
      "rgb(120,0,100)",
      "rgb(160,90,0)",
      "rgb(230,200,0)",
      "rgb(255,250,220)",
    ],
  },
  {
    value: "Bluered",
    translationKey: "bluered",
    colors: ["rgb(0,0,255)", "rgb(255,0,0)"],
  },
  {
    // White at low stop blends into the plot background under contour fill.
    value: "OrRd",
    translationKey: "orrd",
    colors: [
      "rgb(255,247,236)",
      "rgb(254,232,200)",
      "rgb(253,212,158)",
      "rgb(253,187,132)",
      "rgb(252,141,89)",
      "rgb(239,101,72)",
      "rgb(215,48,31)",
      "rgb(179,0,0)",
      "rgb(127,0,0)",
    ],
    plotlyStops: [
      [0, "rgb(255, 247, 236)"],
      [0.125, "rgb(254, 232, 200)"],
      [0.25, "rgb(253, 212, 158)"],
      [0.375, "rgb(253, 187, 132)"],
      [0.5, "rgb(252, 141, 89)"],
      [0.625, "rgb(239, 101, 72)"],
      [0.75, "rgb(215, 48, 31)"],
      [0.875, "rgb(179, 0, 0)"],
      [1, "rgb(127, 0, 0)"],
    ],
  },
  {
    // Magma isn't in plotly.js's built-in names list, so ship stops explicitly.
    value: "Magma",
    translationKey: "magma",
    colors: [
      "rgb(0,0,4)",
      "rgb(28,16,68)",
      "rgb(79,18,123)",
      "rgb(129,37,129)",
      "rgb(181,54,122)",
      "rgb(229,80,100)",
      "rgb(251,135,97)",
      "rgb(254,194,135)",
      "rgb(252,253,191)",
    ],
    plotlyStops: [
      [0, "rgb(0, 0, 4)"],
      [0.125, "rgb(28, 16, 68)"],
      [0.25, "rgb(79, 18, 123)"],
      [0.375, "rgb(129, 37, 129)"],
      [0.5, "rgb(181, 54, 122)"],
      [0.625, "rgb(229, 80, 100)"],
      [0.75, "rgb(251, 135, 97)"],
      [0.875, "rgb(254, 194, 135)"],
      [1, "rgb(252, 253, 191)"],
    ],
  },
  {
    // openJII brand palette, dark-to-light. Stops mirror tailwind.config.ts brand colors.
    value: "OpenJII",
    translationKey: "openjii",
    colors: ["#002F2F", "#005e5e", "#76b465", "#49e06d", "#fff381"],
    plotlyStops: [
      [0, "#002F2F"],
      [0.2, "#005e5e"],
      [0.45, "#76b465"],
      [0.7, "#49e06d"],
      [1, "#fff381"],
    ],
  },
];

export const COLORSCALES: readonly ColorscaleEntry[] = RAW_COLORSCALES.map((raw) => ({
  ...raw,
  gradient: `linear-gradient(to right, ${raw.colors.join(", ")})`,
}));

/** Resolves a colorscale name to either explicit stops or the name itself. */
export function resolveColorscale(name: string): string | [number, string][] {
  const entry = COLORSCALES.find((c) => c.value === name);
  return entry?.plotlyStops ?? name;
}

/** Color stops for a named colorscale, in gradient order. Falls back to the first entry's stops. */
export function colorscaleStops(name: string): readonly string[] {
  const entry = COLORSCALES.find((c) => c.value === name);
  return entry?.colors ?? COLORSCALES[0].colors;
}
