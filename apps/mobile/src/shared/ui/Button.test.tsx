import { render } from "@testing-library/react-native";
import React from "react";
import { TouchableOpacity } from "react-native";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./Button";

vi.mock("~/shared/ui/hooks/use-theme", () => ({
  useTheme: () => ({
    colors: { onPrimary: "#ffffff", primary: { dark: "#004000" } },
  }),
}));

function rootClassName(ui: React.ReactElement): string {
  const { UNSAFE_getByType } = render(ui);
  const root = UNSAFE_getByType(TouchableOpacity);
  return String(root.props.className);
}

describe("Button className", () => {
  it("keeps the variant styling when no className is passed", () => {
    const classes = rootClassName(<Button title="Go" />);

    expect(classes).toContain("bg-primary");
    expect(classes).toContain("rounded-lg");
  });

  it("merges a caller's className with the variant classes instead of replacing them", () => {
    const classes = rootClassName(<Button title="Go" className="mt-4" />);

    expect(classes).toContain("mt-4");
    expect(classes).toContain("bg-primary");
    expect(classes).toContain("rounded-lg");
    expect(classes).toContain("py-2.5");
  });

  it("lets a conflicting caller class win over the variant's", () => {
    const classes = rootClassName(<Button title="Go" className="bg-error" />);

    expect(classes).toContain("bg-error");
    expect(classes).not.toContain("bg-primary");
    expect(classes).toContain("rounded-lg");
  });

  it("still applies the disabled styling alongside a caller's className", () => {
    const classes = rootClassName(<Button title="Go" isDisabled className="mt-4" />);

    expect(classes).toContain("mt-4");
    expect(classes).toContain("opacity-60");
    expect(classes).toContain("bg-inactive");
  });
});
