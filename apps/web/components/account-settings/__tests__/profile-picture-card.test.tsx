import { render, screen } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { ProfilePictureCard } from "../profile-picture-card";

describe("ProfilePictureCard", () => {
  it("renders card with title and disabled badge", () => {
    render(<ProfilePictureCard />);
    expect(screen.getByText("settings.profilePictureCard.title")).toBeInTheDocument();
    expect(screen.getByText("settings.disabled")).toBeInTheDocument();
  });

  it("renders disabled upload button", () => {
    render(<ProfilePictureCard />);
    const button = screen.getByRole("button", {
      name: /settings.profilePictureCard.upload/i,
    });
    expect(button).toBeDisabled();
  });

  it("shows file format and size restrictions", () => {
    render(<ProfilePictureCard />);
    expect(screen.getByText("settings.profilePictureCard.description")).toBeInTheDocument();
  });
});
