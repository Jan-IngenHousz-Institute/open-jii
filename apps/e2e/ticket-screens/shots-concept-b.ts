import { ChangeMarker } from "./change-marker.js";
import {
  miappeFields,
  noLinkedWorkbook,
  overviewRoute,
  readiness,
  trialTables,
} from "./shots-b.js";
import type { TicketShot } from "./shots.js";

// B's shots hide links to the Datasets tab, which F adds, but the concept's publish step points
// there, so its own links stay visible.
const PUBLISH_LINK_CSS =
  '#standards-readiness a[href$="/datasets"] { display: inline-flex !important; }';

const destinationsOnOverview: TicketShot = {
  slug: "b8-concept-b-overview",
  route: async () => `${await overviewRoute()}?readiness=b`,
  fixtures: [trialTables, readiness, miappeFields, noLinkedWorkbook],
  viewport: { width: 1440, height: 1800 },
  prepare: async (page) => {
    const section = page.locator("#standards-readiness");
    await section.getByRole("button", { name: "Phenotyping repositories" }).waitFor();
    await page.getByText("Glycine max").waitFor();
    await page.getByText("Raw Data").first().waitFor();
    await page.addStyleTag({ content: PUBLISH_LINK_CSS });

    const tabs = page.getByRole("tablist").first();
    // The details card runs past the concept, so its corner toggle widens the crop without
    // stretching it down to the card's end.
    const detailsCorner = page.getByRole("button", { name: "Close details panel" });

    const marker = new ChangeMarker(page);
    await marker.mark(section, "Concept B", "above");
    return marker.frame([tabs, section, detailsCorner], 24);
  },
};

export const SHOTS_CONCEPT_B: readonly TicketShot[] = [destinationsOnOverview];
