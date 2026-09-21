import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { Text, View } from "react-native";
import { describe, expect, it, vi } from "vitest";

import { HomeNavCard } from "./home-nav-card";

vi.mock("~/shared/ui/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({ inactive: "#9E9E9E" }),
}));

function renderCard(props: Partial<React.ComponentProps<typeof HomeNavCard>> = {}) {
  return render(
    <HomeNavCard
      icon={<Text>icon</Text>}
      title="Join your organization"
      subtitle="Find your school or lab"
      onPress={vi.fn()}
      {...props}
    />,
  );
}

/** The badge is the only child with an absolute position. */
function badgeClasses(root: ReturnType<typeof render>): string[] {
  return root
    .UNSAFE_queryAllByType(View)
    .map((n) => String((n.props as { className?: string }).className ?? ""))
    .filter((c) => c.includes("absolute"));
}

describe("HomeNavCard", () => {
  it("renders the title and subtitle", () => {
    renderCard();

    expect(screen.getByText("Join your organization")).toBeTruthy();
    expect(screen.getByText("Find your school or lab")).toBeTruthy();
  });

  it("keeps both lines to one line each, so a long name cannot grow the card", () => {
    renderCard();

    expect(screen.getByText("Join your organization").props.numberOfLines).toBe(1);
    expect(screen.getByText("Find your school or lab").props.numberOfLines).toBe(1);
  });

  it("calls onPress when the card is pressed", () => {
    const onPress = vi.fn();
    renderCard({ onPress });

    fireEvent.press(screen.getByText("Join your organization"));

    expect(onPress).toHaveBeenCalledOnce();
  });

  it("renders the icon it is given", () => {
    renderCard({ icon: <Text>my-icon</Text> });

    expect(screen.getByText("my-icon")).toBeTruthy();
  });

  it("renders no badge unless asked", () => {
    const root = renderCard();

    expect(badgeClasses(root)).toHaveLength(0);
  });

  it("puts a requested badge in the top-right corner", () => {
    const root = renderCard({ badge: "top-right", badgeClassName: "bg-jii-primary-bright" });

    const [badge] = badgeClasses(root);
    expect(badge).toContain("-top-0.5");
    expect(badge).toContain("-right-0.5");
    expect(badge).not.toContain("-bottom-0.5");
    expect(badge).toContain("bg-jii-primary-bright");
  });

  it("puts a requested badge in the bottom-right corner", () => {
    const root = renderCard({ badge: "bottom-right", badgeClassName: "bg-[#09b732]" });

    const [badge] = badgeClasses(root);
    expect(badge).toContain("-bottom-0.5");
    expect(badge).toContain("-right-0.5");
    expect(badge).not.toContain("-top-0.5");
    expect(badge).toContain("bg-[#09b732]");
  });

  it("tints the icon tile when a caller computes its own", () => {
    const root = renderCard({ iconTileClassName: "bg-[#fff4d6]" });
    const tiles = root
      .UNSAFE_queryAllByType(View)
      .map((n) => String((n.props as { className?: string }).className ?? ""))
      .filter((c) => c.includes("rounded-[14px]"));

    expect(tiles[0]).toContain("bg-[#fff4d6]");
    expect(tiles[0]).not.toContain("bg-jii-mint");
  });
});
