import { act, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { Text, View } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DiscoverScreen } from "./discover-screen";

const params = vi.hoisted(() => ({ tab: undefined as string | string[] | undefined }));
const setOptions = vi.hoisted(() => vi.fn<(options: { title: string }) => void>());
const experimentsProps = vi.hoisted(() => [] as Record<string, unknown>[]);
const organizationsProps = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ tab: params.tab }),
  useNavigation: () => ({ setOptions }),
}));
vi.mock("./experiments-section", () => ({
  ExperimentsSection: (props: Record<string, unknown>) => {
    experimentsProps.push(props);
    return (
      <View testID="experiments-section">
        <Text>Experiments section</Text>
        <Text>{`term:${String(props.search)}`}</Text>
      </View>
    );
  },
}));
vi.mock("./organizations-section", () => ({
  OrganizationsSection: (props: Record<string, unknown>) => {
    organizationsProps.push(props);
    return (
      <View testID="organizations-section">
        <Text>Organizations section</Text>
        <Text>{`term:${String(props.search)}`}</Text>
      </View>
    );
  },
}));
vi.mock("~/shared/ui/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({ brand: "#005e5e", inactive: "#777777", onSurface: "#121212" }),
}));
vi.mock("~/shared/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        "discover:title": "Discover",
        "discover:tabs.experiments": "Experiments",
        "discover:tabs.organizations": "Organizations",
        "discover:search.placeholder": "Search experiments and organizations",
        "discover:search.clear": "Clear search",
      })[key] ?? key,
  }),
}));

function typeSearch(value: string) {
  fireEvent.changeText(screen.getByPlaceholderText("Search experiments and organizations"), value);
}

/** The hub debounces the term by 250 ms before handing it to a section. */
function settleDebounce() {
  act(() => {
    vi.advanceTimersByTime(300);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  params.tab = undefined;
  setOptions.mockClear();
  experimentsProps.length = 0;
  organizationsProps.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("DiscoverScreen", () => {
  it("titles itself Discover", () => {
    render(<DiscoverScreen />);

    expect(setOptions).toHaveBeenCalledWith({ title: "Discover" });
  });

  it("offers exactly the two tabs and one search field", () => {
    render(<DiscoverScreen />);

    expect(screen.getByText("Experiments")).toBeTruthy();
    expect(screen.getByText("Organizations")).toBeTruthy();
    expect(screen.getAllByPlaceholderText("Search experiments and organizations")).toHaveLength(1);
  });

  it("switches with the underline bar the measure surfaces use, which announces its tabs", () => {
    render(<DiscoverScreen />);

    // Only the underline variant gives its tabs a role and a selected state;
    // the pill variant renders neither, so this pins the variant too.
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    expect(tabs[0]?.props.accessibilityState).toEqual({ selected: true });
    expect(tabs[1]?.props.accessibilityState).toEqual({ selected: false });
  });

  describe("which tab it opens on", () => {
    it("lands on experiments with no param, so a workshop student sees the code row", () => {
      render(<DiscoverScreen />);

      expect(screen.getByTestId("experiments-section")).toBeTruthy();
      expect(screen.queryByTestId("organizations-section")).toBeNull();
    });

    it("lands on organizations when the param says so", () => {
      params.tab = "organizations";

      render(<DiscoverScreen />);

      expect(screen.getByTestId("organizations-section")).toBeTruthy();
      expect(screen.queryByTestId("experiments-section")).toBeNull();
    });

    it("falls back to experiments for an unknown tab", () => {
      params.tab = "protocols";

      render(<DiscoverScreen />);

      expect(screen.getByTestId("experiments-section")).toBeTruthy();
    });

    it("takes the first of a repeated param, which arrives as an array", () => {
      params.tab = ["organizations", "experiments"];

      render(<DiscoverScreen />);

      expect(screen.getByTestId("organizations-section")).toBeTruthy();
    });

    it("falls back to experiments for an array of nonsense", () => {
      params.tab = ["protocols"];

      render(<DiscoverScreen />);

      expect(screen.getByTestId("experiments-section")).toBeTruthy();
    });
  });

  describe("only the active section runs a query", () => {
    it("enables experiments and mounts nothing for organizations", () => {
      render(<DiscoverScreen />);

      expect(experimentsProps.at(-1)?.enabled).toBe(true);
      expect(organizationsProps).toHaveLength(0);
    });

    it("enables organizations and mounts nothing for experiments", () => {
      params.tab = "organizations";

      render(<DiscoverScreen />);

      expect(organizationsProps.at(-1)?.enabled).toBe(true);
      expect(experimentsProps).toHaveLength(0);
    });

    it("stops rendering the section it just left, so its query goes nowhere", () => {
      render(<DiscoverScreen />);
      const rendersBeforeSwitch = experimentsProps.length;

      fireEvent.press(screen.getByText("Organizations"));

      expect(screen.queryByTestId("experiments-section")).toBeNull();
      expect(experimentsProps).toHaveLength(rendersBeforeSwitch);
      expect(organizationsProps.at(-1)?.enabled).toBe(true);
    });
  });

  describe("the shared term", () => {
    it("reaches the active section only after the debounce", () => {
      render(<DiscoverScreen />);

      typeSearch("canopy");
      expect(screen.getByText("term:")).toBeTruthy();

      settleDebounce();
      expect(screen.getByText("term:canopy")).toBeTruthy();
    });

    it("survives a tab switch, so canopy flips between the two lists", () => {
      render(<DiscoverScreen />);
      typeSearch("canopy");
      settleDebounce();

      fireEvent.press(screen.getByText("Organizations"));

      expect(screen.getByTestId("organizations-section")).toBeTruthy();
      expect(screen.getByText("term:canopy")).toBeTruthy();
      expect(screen.getByPlaceholderText("Search experiments and organizations").props.value).toBe(
        "canopy",
      );
    });

    it("clears back to the whole list", () => {
      render(<DiscoverScreen />);
      typeSearch("canopy");
      settleDebounce();

      fireEvent.press(screen.getByLabelText("Clear search"));
      settleDebounce();

      expect(screen.getByText("term:")).toBeTruthy();
    });

    it("hides the clear button until something is typed", () => {
      render(<DiscoverScreen />);

      expect(screen.queryByLabelText("Clear search")).toBeNull();

      typeSearch("c");
      expect(screen.getByLabelText("Clear search")).toBeTruthy();
    });
  });

  describe("the result count", () => {
    it("shows what the active section reports", () => {
      render(<DiscoverScreen />);

      act(() => {
        (experimentsProps.at(-1)?.onStatusChange as (s: unknown) => void)({
          count: 14,
          isFetching: false,
        });
      });

      expect(screen.getByText("14")).toBeTruthy();
    });

    it("resets on a tab switch rather than carrying the other tab's number over", () => {
      render(<DiscoverScreen />);
      act(() => {
        (experimentsProps.at(-1)?.onStatusChange as (s: unknown) => void)({
          count: 14,
          isFetching: false,
        });
      });

      fireEvent.press(screen.getByText("Organizations"));

      expect(screen.queryByText("14")).toBeNull();
      expect(screen.getByText("0")).toBeTruthy();
    });

    it("gives way to a spinner while a typed term is fetching", () => {
      render(<DiscoverScreen />);
      typeSearch("canopy");

      act(() => {
        (experimentsProps.at(-1)?.onStatusChange as (s: unknown) => void)({
          count: 3,
          isFetching: true,
        });
      });

      expect(screen.queryByText("3")).toBeNull();
    });

    it("keeps the count visible while a no-term browse refetches", () => {
      render(<DiscoverScreen />);

      act(() => {
        (experimentsProps.at(-1)?.onStatusChange as (s: unknown) => void)({
          count: 3,
          isFetching: true,
        });
      });

      expect(screen.getByText("3")).toBeTruthy();
    });
  });
});
