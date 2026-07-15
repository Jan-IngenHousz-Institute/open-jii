import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import ApiKeysPage from "./page";

vi.mock("~/components/account-settings/api-keys/api-keys-card", () => ({
  ApiKeysCard: () => <div data-testid="api-keys-card">API Keys</div>,
}));

describe("ApiKeysPage", () => {
  it("renders the API keys card", () => {
    render(<ApiKeysPage />);

    expect(screen.getByTestId("api-keys-card")).toBeInTheDocument();
  });
});
