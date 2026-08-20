import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { CredentialsShowOnceBanner } from "./credentials-show-once-banner";

describe("CredentialsShowOnceBanner", () => {
  it("warns that the keys are shown only once", () => {
    render(<CredentialsShowOnceBanner />);

    expect(screen.getByText("iot.devices.credentials.showOnceWarning")).toBeInTheDocument();
  });
});
