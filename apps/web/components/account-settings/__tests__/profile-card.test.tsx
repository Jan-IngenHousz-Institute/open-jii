import { renderWithForm, screen } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import type { CreateUserProfileBody } from "@repo/api";

import { ProfileCard } from "../profile-card";

const defaults: CreateUserProfileBody = {
  firstName: "",
  lastName: "",
  bio: "",
  organization: "",
};

const setup = () =>
  renderWithForm<CreateUserProfileBody>((form) => <ProfileCard form={form} />, {
    useFormProps: { defaultValues: defaults },
  });

describe("ProfileCard", () => {
  it("renders card title", () => {
    setup();
    expect(screen.getByText("settings.profileCard.title")).toBeInTheDocument();
  });

  it("renders first name and last name labels", () => {
    setup();
    expect(screen.getByText("registration.firstName")).toBeInTheDocument();
    expect(screen.getByText("registration.lastName")).toBeInTheDocument();
  });

  it("renders bio textarea with placeholder", () => {
    setup();
    expect(screen.getByPlaceholderText("settings.profileCard.bioPlaceholder")).toBeInTheDocument();
  });

  it("renders organization field", () => {
    setup();
    expect(
      screen.getByPlaceholderText("settings.profileCard.institutionPlaceholder"),
    ).toBeInTheDocument();
  });

  it("renders disabled professional title and department fields", () => {
    setup();
    expect(screen.getByText("settings.profileCard.professionalTitle")).toBeInTheDocument();
    expect(screen.getByText("settings.profileCard.department")).toBeInTheDocument();
    expect(screen.getAllByText("settings.disabled").length).toBeGreaterThanOrEqual(2);
  });

  it("renders all expected labels", () => {
    setup();
    const labels = [
      "registration.firstName",
      "registration.lastName",
      "settings.profileCard.professionalTitle",
      "settings.profileCard.bio",
      "settings.profileCard.institution",
      "settings.profileCard.department",
    ];
    labels.forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
  });
});
