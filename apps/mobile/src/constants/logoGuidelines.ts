// JII Design System - Logo Guidelines

export const logoGuidelines = {
  // Minimum size requirements
  minimumSize: {
    vertical: "15mm", // 15mm for vertical logo
    horizontal: "26mm", // 26mm for horizontal logo
  },

  // Buffer zone
  bufferZone: 'Equal to the height of the "H" in the logo',

  // Usage rules
  usageRules: [
    "Logo must not be modified",
    "Logo must not be reshaped",
    "Logo must not be tilted",
    "Logo font must not be changed",
    "Maintain proper contrast with background",
    "Do not place logo on busy backgrounds",
    "Do not add effects like shadows or glows",
  ],

  // File formats
  fileFormats: {
    print: ["EPS (CMYK)", "EPS (B&W)", "PDF (CMYK)", "PDF (B&W)"],
    digital: ["EPS (RGB)", "EPS (B&W)", "SVG (RGB)", "SVG (B&W)", "PNG (RGB)", "PNG (B&W)"],
  },

  // Logo variations
  variations: [
    "Full color on light background",
    "Full color on dark background",
    "White (reversed) on dark background",
    "Black on light background",
  ],
};
