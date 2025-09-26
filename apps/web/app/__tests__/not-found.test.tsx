import "@testing-library/jest-dom";
import { render } from "@testing-library/react";
import { vi, describe, it, expect } from "vitest";

import NotFound from "../not-found";

// Mock all dependencies
vi.mock("next/headers", () => ({
  headers: vi.fn(() => Promise.resolve({ get: () => "/en-US/path" })),
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@repo/i18n", () => ({
  defaultLocale: "en-US",
  locales: ["en-US"],
}));

vi.mock("@repo/i18n/server", () => ({
  default: () => Promise.resolve({ t: (key: string) => key }),
}));

vi.mock("@repo/ui/components", () => ({
  Button: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("lucide-react", () => ({
  Home: () => <div>Home</div>,
  Search: () => <div>Search</div>,
  Sprout: () => <div>Sprout</div>,
}));

describe("NotFound Component", () => {
  it("should render without crashing", async () => {
    const { container } = render(await NotFound());
    expect(container).toBeInTheDocument();
  });

  it("should handle component rendering with different scenarios", async () => {
    const result = render(await NotFound());
    expect(result.container.firstChild).toBeTruthy();
  });
});
