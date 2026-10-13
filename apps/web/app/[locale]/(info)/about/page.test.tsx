import { permanentRedirect } from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import AboutPage from "./page";

vi.mock("next/navigation", () => ({ permanentRedirect: vi.fn() }));

describe("retired About page", () => {
  it.each(["en-US", "de-DE"])(
    "redirects %s links to the homepage institute section",
    async (locale) => {
      await AboutPage({ params: Promise.resolve({ locale }) });
      expect(permanentRedirect).toHaveBeenCalledWith(`/${locale}#about-jii`);
    },
  );
});
