import localFont from "next/font/local";

// Served from the repository so a build never depends on Google Fonts. Each family keeps Google's
// subsets and unicode ranges, so a page downloads only the subsets its text uses and preloads only
// Latin. The family is named after the exported constant, which Next.js needs to match it.

// The variable has to sit on <html> so theme.css can resolve `--font-sans` in `:root`.
export const inter = localFont({
  src: "./inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-inter",
  declarations: [
    { prop: "font-family", value: "inter" },
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});

const _interLatinExt = localFont({
  src: "./inter-latin-ext-wght-normal.woff2",
  weight: "100 900",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "inter" },
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
});

const _interCyrillic = localFont({
  src: "./inter-cyrillic-wght-normal.woff2",
  weight: "100 900",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "inter" },
    { prop: "unicode-range", value: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116" },
  ],
});

const _interCyrillicExt = localFont({
  src: "./inter-cyrillic-ext-wght-normal.woff2",
  weight: "100 900",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "inter" },
    {
      prop: "unicode-range",
      value: "U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F",
    },
  ],
});

const _interGreek = localFont({
  src: "./inter-greek-wght-normal.woff2",
  weight: "100 900",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "inter" },
    {
      prop: "unicode-range",
      value: "U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF",
    },
  ],
});

const _interGreekExt = localFont({
  src: "./inter-greek-ext-wght-normal.woff2",
  weight: "100 900",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "inter" },
    { prop: "unicode-range", value: "U+1F00-1FFF" },
  ],
});

const _interVietnamese = localFont({
  src: "./inter-vietnamese-wght-normal.woff2",
  weight: "100 900",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "inter" },
    {
      prop: "unicode-range",
      value:
        "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB",
    },
  ],
});

// The variable has to sit on <html> so theme.css can resolve `--font-mono` in `:root`.
export const jetbrainsMono = localFont({
  src: "./jetbrains-mono-latin-wght-normal.woff2",
  weight: "100 800",
  variable: "--font-jetbrains-mono",
  declarations: [
    { prop: "font-family", value: "jetbrainsMono" },
    {
      prop: "unicode-range",
      value:
        "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
});

const _jetbrainsMonoLatinExt = localFont({
  src: "./jetbrains-mono-latin-ext-wght-normal.woff2",
  weight: "100 800",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "jetbrainsMono" },
    {
      prop: "unicode-range",
      value:
        "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
});

const _jetbrainsMonoCyrillic = localFont({
  src: "./jetbrains-mono-cyrillic-wght-normal.woff2",
  weight: "100 800",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "jetbrainsMono" },
    { prop: "unicode-range", value: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116" },
  ],
});

const _jetbrainsMonoCyrillicExt = localFont({
  src: "./jetbrains-mono-cyrillic-ext-wght-normal.woff2",
  weight: "100 800",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "jetbrainsMono" },
    {
      prop: "unicode-range",
      value: "U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F",
    },
  ],
});

const _jetbrainsMonoGreek = localFont({
  src: "./jetbrains-mono-greek-wght-normal.woff2",
  weight: "100 800",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "jetbrainsMono" },
    {
      prop: "unicode-range",
      value: "U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF",
    },
  ],
});

const _jetbrainsMonoVietnamese = localFont({
  src: "./jetbrains-mono-vietnamese-wght-normal.woff2",
  weight: "100 800",
  preload: false,
  adjustFontFallback: false,
  declarations: [
    { prop: "font-family", value: "jetbrainsMono" },
    {
      prop: "unicode-range",
      value:
        "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB",
    },
  ],
});
