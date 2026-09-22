import { db } from "../../src/database";
import { protocols, macros, protocolMacros } from "../../src/schema";
import type { SeedMacro, SeedProtocol } from "./types";

/** The cross-links, seeded wide enough that a protocol detail page is never empty. */
export async function seedProtocolMacroLinks(
  createdProtocols: SeedProtocol[],
  createdMacros: SeedMacro[],
) {
  // 4. Link protocols ↔ macros (diverse cross-links)
  const p = createdProtocols;
  const m = createdMacros;
  const pmLinks = [
    // Chlorophyll Fluorescence → Phi2 Quantum Yield, Data Formatter, Outlier Detection
    { protocolId: p[0].id, macroId: m[0].id },
    { protocolId: p[0].id, macroId: m[5].id },
    { protocolId: p[0].id, macroId: m[3].id },
    // Leaf Thickness → SPAD Estimator, Statistical Summary
    { protocolId: p[1].id, macroId: m[1].id },
    { protocolId: p[1].id, macroId: m[8].id },
    // SPAD Chlorophyll Index → SPAD Estimator, NDVI Calculator, Outlier Detection
    { protocolId: p[2].id, macroId: m[1].id },
    { protocolId: p[2].id, macroId: m[4].id },
    { protocolId: p[2].id, macroId: m[3].id },
    // PAR → Data Formatter, Unit Converter
    { protocolId: p[3].id, macroId: m[5].id },
    { protocolId: p[3].id, macroId: m[6].id },
    // ECS → ECS Decay Analysis, Statistical Summary
    { protocolId: p[4].id, macroId: m[2].id },
    { protocolId: p[4].id, macroId: m[8].id },
    // Leaf Reflectance NDVI → NDVI Calculator, Data Formatter
    { protocolId: p[5].id, macroId: m[4].id },
    { protocolId: p[5].id, macroId: m[5].id },
    // Soil Moisture → Geolocation Tagger, Unit Converter
    { protocolId: p[6].id, macroId: m[7].id },
    { protocolId: p[6].id, macroId: m[6].id },
    // Ambient Light & Temp → Data Formatter, ANOVA Analysis
    { protocolId: p[7].id, macroId: m[5].id },
    { protocolId: p[7].id, macroId: m[9].id },
    // Soil EC & pH → Statistical Summary, Geolocation Tagger
    { protocolId: p[8].id, macroId: m[8].id },
    { protocolId: p[8].id, macroId: m[7].id },
    // Canopy Temperature → Outlier Detection, ANOVA Analysis
    { protocolId: p[9].id, macroId: m[3].id },
    { protocolId: p[9].id, macroId: m[9].id },
  ];

  await db.insert(protocolMacros).values(pmLinks);
  console.log(`  Created ${pmLinks.length} protocol-macro links`);
}
