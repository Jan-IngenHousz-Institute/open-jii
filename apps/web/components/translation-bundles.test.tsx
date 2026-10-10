import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { TranslationBundles } from "./translation-bundles";

const store = new Map<string, unknown>();
const i18n = vi.hoisted(() => ({
  hasResourceBundle: vi.fn(),
  addResourceBundle: vi.fn(),
}));

vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n }),
}));

const resources = {
  "en-US": { experiments: { title: "Experiments" }, workbook: { title: "Workbooks" } },
};

describe("TranslationBundles", () => {
  beforeEach(() => {
    store.clear();
    i18n.hasResourceBundle.mockImplementation((language: string, namespace: string) =>
      store.has(`${language}/${namespace}`),
    );
    i18n.addResourceBundle.mockImplementation(
      (language: string, namespace: string, bundle: unknown) => {
        store.set(`${language}/${namespace}`, bundle);
      },
    );
    i18n.addResourceBundle.mockClear();
  });

  it("adds each namespace to the page's instance and renders its children", () => {
    render(
      <TranslationBundles resources={resources}>
        <p>section</p>
      </TranslationBundles>,
    );

    expect(screen.getByText("section")).toBeInTheDocument();
    expect(i18n.addResourceBundle).toHaveBeenCalledWith("en-US", "experiments", {
      title: "Experiments",
    });
    expect(i18n.addResourceBundle).toHaveBeenCalledWith("en-US", "workbook", {
      title: "Workbooks",
    });
  });

  it("leaves a namespace the page already has alone", () => {
    store.set("en-US/experiments", { title: "Experiments" });

    const { rerender } = render(
      <TranslationBundles resources={resources}>
        <p>section</p>
      </TranslationBundles>,
    );
    rerender(
      <TranslationBundles resources={resources}>
        <p>section</p>
      </TranslationBundles>,
    );

    expect(i18n.addResourceBundle).toHaveBeenCalledTimes(1);
    expect(i18n.addResourceBundle).toHaveBeenCalledWith("en-US", "workbook", {
      title: "Workbooks",
    });
  });
});
