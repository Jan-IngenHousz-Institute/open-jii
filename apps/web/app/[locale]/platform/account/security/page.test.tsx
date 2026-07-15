import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import SecurityPage from "./page";

vi.mock("~/components/account-settings/passkeys/passkeys-card", () => ({
  PasskeysCard: () => <div data-testid="passkeys-card">Passkeys</div>,
}));

describe("SecurityPage", () => {
  it("renders the passkeys card", () => {
    render(<SecurityPage />);

    expect(screen.getByTestId("passkeys-card")).toBeInTheDocument();
  });
});
