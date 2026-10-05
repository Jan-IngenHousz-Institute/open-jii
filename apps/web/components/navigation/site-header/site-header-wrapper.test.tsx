import { CalibrationFlagProvider } from "@/components/calibrations/calibration-flag-context";
import { render, screen } from "@/test/test-utils";
import { usePathname } from "next/navigation";
import { describe, it, expect, vi } from "vitest";

import initTranslations from "@repo/i18n/server";
import { SidebarProvider } from "@repo/ui/components/sidebar";

import { PlatformHeaderProvider } from "./platform-header-context";
import { SiteHeaderWrapper } from "./site-header-wrapper";

async function renderWrapper(pathname: string) {
  vi.mocked(usePathname).mockReturnValue(pathname);
  const header = await SiteHeaderWrapper({ locale: "en" });
  return render(
    <CalibrationFlagProvider isEnabled={false}>
      <SidebarProvider>
        <PlatformHeaderProvider>{header}</PlatformHeaderProvider>
      </SidebarProvider>
    </CalibrationFlagProvider>,
  );
}

describe("SiteHeaderWrapper", () => {
  it("translates the header's strings on the server, in the namespaces they live in", async () => {
    await renderWrapper("/en/platform/experiments");

    // The global mock lists only a few namespaces; the wrapper asks for the ones its labels use.
    const { namespaces } = vi.mocked(initTranslations).mock.lastCall?.[0] ?? {};
    expect(namespaces).toEqual(["common", "experiments"]);
    expect(screen.getByRole("link", { name: "experiments.create" })).toBeInTheDocument();
  });
});
