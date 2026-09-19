import { and } from "drizzle-orm";

import { db } from "../../src/database";
import { macros } from "../../src/schema";
import type { SeedUser } from "./types";

/** Analysis macros across the three sandbox languages. */
export async function seedMacros(user: SeedUser, personalOrganizationId: string) {
  // 3. Create macros (12 total — 5 python, 3 javascript, 2 r; some with sortOrder)
  const macroData: {
    name: string;
    language: "python" | "javascript" | "r";
    description: string;
    code: string;
    sortOrder?: number;
  }[] = [
    {
      name: "[Seed] Phi2 Quantum Yield",
      language: "python",
      description: "Calculates Phi2 quantum yield of photosystem II from fluorescence trace data.",
      code: btoa(
        "import numpy as np\n\ndef analyze(data):\n    fm_prime = data['Fm_prime']\n    fs = data['Fs']\n    return {'Phi2': (fm_prime - fs) / fm_prime}\n",
      ),
      sortOrder: 1,
    },
    {
      name: "[Seed] SPAD Estimator",
      language: "python",
      description:
        "Estimates SPAD chlorophyll values from dual-wavelength absorbance measurements.",
      code: btoa(
        "def estimate_spad(abs_650, abs_940):\n    ratio = abs_650 / abs_940\n    return ratio * 45.2 + 1.3\n",
      ),
      sortOrder: 2,
    },
    {
      name: "[Seed] ECS Decay Analysis",
      language: "python",
      description:
        "Fits exponential decay curves to electrochromic shift signals for pmf estimation.",
      code: btoa(
        "import numpy as np\nfrom scipy.optimize import curve_fit\n\ndef ecs_decay(t, a, tau):\n    return a * np.exp(-t / tau)\n",
      ),
      sortOrder: 3,
    },
    {
      name: "[Seed] Outlier Detection",
      language: "python",
      description: "Flags statistical outliers in measurement datasets using IQR method.",
      code: btoa(
        "import numpy as np\n\ndef flag_outliers(values):\n    q1, q3 = np.percentile(values, [25, 75])\n    iqr = q3 - q1\n    return (values < q1 - 1.5 * iqr) | (values > q3 + 1.5 * iqr)\n",
      ),
      sortOrder: 4,
    },
    {
      name: "[Seed] NDVI Calculator",
      language: "python",
      description: "Computes NDVI from red and NIR reflectance bands.",
      code: btoa("def ndvi(red, nir):\n    return (nir - red) / (nir + red)\n"),
      sortOrder: 5,
    },
    {
      name: "[Seed] Data Formatter",
      language: "javascript",
      description: "Formats raw sensor output into a standardized JSON structure with timestamps.",
      code: btoa(
        "function format(raw) {\n  return {\n    timestamp: Date.now(),\n    values: raw,\n    version: '1.0'\n  };\n}\n",
      ),
      sortOrder: 6,
    },
    {
      name: "[Seed] Unit Converter",
      language: "javascript",
      description: "Converts measurement units between metric and imperial for field data.",
      code: btoa(
        "const conversions = {\n  cm_to_in: v => v * 0.3937,\n  c_to_f: v => v * 9/5 + 32,\n  kpa_to_psi: v => v * 0.14504\n};\n",
      ),
      sortOrder: 7,
    },
    {
      name: "[Seed] Geolocation Tagger",
      language: "javascript",
      description: "Attaches GPS coordinates and location metadata to measurement records.",
      code: btoa(
        "function tagLocation(record, lat, lon) {\n  return { ...record, location: { lat, lon, tagged_at: new Date().toISOString() } };\n}\n",
      ),
      sortOrder: 8,
    },
    {
      name: "[Seed] Statistical Summary",
      language: "r",
      description:
        "Generates summary statistics (mean, median, sd, min, max) for all measurement columns.",
      code: btoa(
        "summary_stats <- function(df) {\n  sapply(df, function(x) c(mean=mean(x), median=median(x), sd=sd(x), min=min(x), max=max(x)))\n}\n",
      ),
      sortOrder: 9,
    },
    {
      name: "[Seed] ANOVA Analysis",
      language: "r",
      description: "Performs one-way ANOVA and Tukey HSD post-hoc tests across treatment groups.",
      code: btoa(
        "run_anova <- function(df, response, treatment) {\n  model <- aov(as.formula(paste(response, '~', treatment)), data=df)\n  list(anova=summary(model), tukey=TukeyHSD(model))\n}\n",
      ),
      sortOrder: 10,
    },
  ];

  const createdMacros = [];
  for (const m of macroData) {
    const macroId = crypto.randomUUID();
    const [macro] = await db
      .insert(macros)
      .values({
        id: macroId,
        name: m.name,
        filename: `seed_macro_${macroId.replace(/-/g, "").substring(0, 16)}`,
        description: m.description,
        language: m.language,
        code: m.code,
        sortOrder: m.sortOrder ?? null,
        createdBy: user.id,
        organizationId: personalOrganizationId,
      })
      .returning();
    createdMacros.push(macro);
  }

  console.log(`  Created ${createdMacros.length} macros`);

  return createdMacros;
}
