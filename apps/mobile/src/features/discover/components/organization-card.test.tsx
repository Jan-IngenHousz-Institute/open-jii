import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { Image } from "react-native";
import { describe, expect, it, vi } from "vitest";

import type { OrganizationDirectoryEntry } from "@repo/api/domains/organization/organization.schema";

import { OrganizationCard } from "./organization-card";

vi.mock("~/shared/constants/colors", () => ({ colors: { jii: { darkGreen: "#004000" } } }));
vi.mock("~/shared/ui/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({ inactive: "#777777" }),
}));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, values?: { count?: number }) => {
      const labels: Record<string, string> = {
        "organizations:type.research_institute": "Research institute",
        "organizations:type.university": "University",
        "membership.private": "Private",
        "membership.member": "Joined",
        "membership.requested": "Requested",
      };
      if (key === "memberCount") {
        return `${String(values?.count)} ${values?.count === 1 ? "member" : "members"}`;
      }
      return labels[key] ?? key;
    },
  }),
}));

function entry(overrides: Partial<OrganizationDirectoryEntry> = {}): OrganizationDirectoryEntry {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Photosynthesis Lab Utrecht",
    slug: "photosynthesis-lab",
    logo: null,
    type: "research_institute",
    description: null,
    location: "Utrecht",
    memberCount: 12,
    resourceCount: 9,
    visibility: "public",
    membershipStatus: "none",
    ...overrides,
  };
}

describe("OrganizationCard", () => {
  it("renders type · location · members", () => {
    render(<OrganizationCard organization={entry()} onPress={vi.fn()} />);

    expect(screen.getByText("Photosynthesis Lab Utrecht")).toBeTruthy();
    expect(screen.getByText("Research institute · Utrecht · 12 members")).toBeTruthy();
  });

  it("omits a null type and a null location rather than leaving separators", () => {
    render(
      <OrganizationCard organization={entry({ type: null, location: null })} onPress={vi.fn()} />,
    );

    expect(screen.getByText("12 members")).toBeTruthy();
  });

  it("omits only the null part when the other is present", () => {
    render(<OrganizationCard organization={entry({ location: null })} onPress={vi.fn()} />);

    expect(screen.getByText("Research institute · 12 members")).toBeTruthy();
  });

  it("uses the singular member form for a one-person organization", () => {
    render(
      <OrganizationCard
        organization={entry({ type: null, location: null, memberCount: 1 })}
        onPress={vi.fn()}
      />,
    );

    expect(screen.getByText("1 member")).toBeTruthy();
  });

  it("shows no status tags for a public organization the caller is not in", () => {
    render(<OrganizationCard organization={entry()} onPress={vi.fn()} />);

    expect(screen.queryByText("Private")).toBeNull();
    expect(screen.queryByText("Joined")).toBeNull();
    expect(screen.queryByText("Requested")).toBeNull();
  });

  it("tags a pending request as Requested", () => {
    render(
      <OrganizationCard
        organization={entry({ membershipStatus: "pending_request" })}
        onPress={vi.fn()}
      />,
    );

    expect(screen.getByText("Requested")).toBeTruthy();
    expect(screen.queryByText("Joined")).toBeNull();
  });

  it("says Joined, not Member, so it never collides with the role wording", () => {
    render(
      <OrganizationCard
        organization={entry({ visibility: "private", membershipStatus: "member" })}
        onPress={vi.fn()}
      />,
    );

    expect(screen.getByText("Private")).toBeTruthy();
    expect(screen.getByText("Joined")).toBeTruthy();
    expect(screen.queryByText("Member")).toBeNull();
  });

  it("falls back to the building icon when the organization has no logo", () => {
    const { UNSAFE_queryAllByType } = render(
      <OrganizationCard organization={entry()} onPress={vi.fn()} />,
    );
    expect(UNSAFE_queryAllByType(Image)).toHaveLength(0);
  });

  it("renders the logo image when there is one", () => {
    const { UNSAFE_queryAllByType } = render(
      <OrganizationCard
        organization={entry({ logo: "https://cdn.example.org/logo.png" })}
        onPress={vi.fn()}
      />,
    );
    const images = UNSAFE_queryAllByType(Image);
    expect(images).toHaveLength(1);
    expect(images[0]?.props.source).toEqual({ uri: "https://cdn.example.org/logo.png" });
  });

  it("truncates a long name to one line so the tags keep their slot", () => {
    render(
      <OrganizationCard
        organization={entry({
          name: "Wageningen University & Research Centre for Crop Systems Analysis",
          membershipStatus: "member",
        })}
        onPress={vi.fn()}
      />,
    );

    const name = screen.getByText(
      "Wageningen University & Research Centre for Crop Systems Analysis",
    );
    expect(name.props.numberOfLines).toBe(1);
    expect(screen.getByText("Joined")).toBeTruthy();
  });

  it("hands the organization id back on press", () => {
    const onPress = vi.fn();
    render(<OrganizationCard organization={entry()} onPress={onPress} />);

    fireEvent.press(screen.getByText("Photosynthesis Lab Utrecht"));

    expect(onPress).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000001");
  });
});
