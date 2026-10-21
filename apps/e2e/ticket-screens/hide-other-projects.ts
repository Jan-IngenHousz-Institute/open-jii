import type { Page } from "@playwright/test";

import type { Fixture } from "./fixture.js";

/** A scaffold surface and the projects whose tickets may show it, by slug letter. */
interface ScaffoldSurface {
  readonly selector: string;
  readonly projects: string;
}

const SURFACES: readonly ScaffoldSurface[] = [
  { selector: 'a[href$="/layout"]', projects: "bcde" },
  { selector: 'a[href$="/datasets"]', projects: "bf" },
  { selector: '[data-testid="experiment-publications"]', projects: "f" },
];

/**
 * Every project's scaffold runs in one web app, so a shot would otherwise show tabs and sections
 * that another project adds. Hides each surface unless the shot's slug starts with a project
 * allowed to show it.
 */
export class HideOtherProjects implements Fixture {
  private readonly css: string;

  constructor(slug: string) {
    const project = /^([a-f])\d/.exec(slug)?.[1] ?? "";
    this.css = SURFACES.filter((surface) => !surface.projects.includes(project || "-"))
      .map((surface) => `${surface.selector} { display: none !important; }`)
      .join("\n");
  }

  async install(page: Page): Promise<void> {
    // An adopted sheet lives outside the DOM, so hydration cannot drop it as it can a <style> tag.
    await page.addInitScript((css) => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    }, this.css);
  }
}
