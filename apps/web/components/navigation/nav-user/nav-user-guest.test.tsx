import { mockRealTranslations, TEST_LOCALES } from "@/test/real-i18n";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { SidebarProvider } from "@repo/ui/components/sidebar";

import { NavUser } from "./nav-user";

describe("guest account label", () => {
  it.each(TEST_LOCALES)(
    "shows the name and guest marker without an account link in %s",
    async (locale) => {
      const i18n = await mockRealTranslations(locale);
      render(
        <SidebarProvider>
          <NavUser
            user={{ id: "guest", email: "", name: "Synthetic", isAnonymous: true }}
            locale={locale}
          />
        </SidebarProvider>,
      );
      const expected = i18n.t("auth.userDisplayName", { context: "guest", name: "Synthetic" });
      expect(expected).not.toBe("auth.userDisplayName");
      expect(screen.getByText(expected)).toBeInTheDocument();
      await userEvent.setup().click(screen.getByRole("button"));
      expect(
        screen.queryByRole("menuitem", { name: i18n.t("auth.account") }),
      ).not.toBeInTheDocument();
      expect(document.body.textContent).not.toContain("guest.openjii.invalid");
    },
  );
});
