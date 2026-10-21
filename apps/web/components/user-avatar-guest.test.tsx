import { mockRealTranslations, TEST_LOCALES } from "@/test/real-i18n";
import { render, screen } from "@/test/test-utils";
import { personDisplayName } from "@/util/person-display-name";
import { describe, expect, it } from "vitest";

import { UserAvatar } from "./user-avatar";

const guestLabels = {
  "en-US": "Synthetic (guest)",
  "nl-NL": "Synthetic (gast)",
  "de-DE": "Synthetic (Gast)",
};
const formerLabels = {
  "en-US": "Former guest",
  "nl-NL": "Voormalige gast",
  "de-DE": "Ehemaliger Gast",
};

describe("localized guest attribution", () => {
  it.each(TEST_LOCALES)("renders raw guest names and former-guest status in %s", async (locale) => {
    const i18n = await mockRealTranslations(locale);
    const { rerender } = render(<UserAvatar firstName="Synthetic" lastName="" isGuest />);
    expect(screen.getByTitle(guestLabels[locale])).toBeInTheDocument();
    expect(personDisplayName({ firstName: "Synthetic", isGuest: true }, i18n.t)).toBe(
      guestLabels[locale],
    );
    rerender(<UserAvatar firstName="Guest" lastName="" isGuest />);
    expect(
      screen.getByTitle(i18n.t("members.displayName", { context: "unnamedGuest", name: "" })),
    ).toBeInTheDocument();
    rerender(<UserAvatar firstName="" lastName="" isGuest isFormerGuest />);
    expect(screen.getByTitle(formerLabels[locale])).toBeInTheDocument();
    expect(personDisplayName({ firstName: "Synthetic", lastName: "Researcher" }, i18n.t)).toBe(
      "Synthetic Researcher",
    );
  });
});
