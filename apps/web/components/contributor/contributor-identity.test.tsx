import { mockRealTranslations, TEST_LOCALES } from "@/test/real-i18n";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { ContributorIdentity } from "./contributor-identity";

describe("<ContributorIdentity />", () => {
  it.each(TEST_LOCALES)(
    "localizes measured guest and former-guest attribution in %s",
    async (locale) => {
      const i18n = await mockRealTranslations(locale);
      const { rerender } = render(
        <ContributorIdentity
          data={{
            id: "guest",
            name: "Synthetic",
            avatar: null,
            isGuest: true,
            isFormerGuest: false,
          }}
        />,
      );
      expect(
        screen.getByText(i18n.t("members.displayName", { context: "guest", name: "Synthetic" })),
      ).toBeInTheDocument();
      rerender(
        <ContributorIdentity
          data={JSON.stringify({
            id: "former",
            name: "Old cached name",
            avatar: null,
            isGuest: true,
            isFormerGuest: true,
          })}
        />,
      );
      expect(
        screen.getByText(i18n.t("members.displayName", { context: "formerGuest", name: "" })),
      ).toBeInTheDocument();
      expect(screen.queryByText("Old cached name")).not.toBeInTheDocument();
      rerender(
        <ContributorIdentity
          data={{
            id: "researcher",
            name: "Researcher",
            avatar: null,
            isGuest: false,
            isFormerGuest: false,
          }}
        />,
      );
      expect(screen.getByText("Researcher")).toBeInTheDocument();
    },
  );
  it("renders the contributor name from a struct payload", () => {
    render(<ContributorIdentity data={{ id: "u1", name: "Jane Doe", avatar: null }} />);
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
  });

  it("renders initials in the avatar fallback when no image is given", () => {
    render(<ContributorIdentity data={{ id: "u1", name: "Jane Doe", avatar: null }} />);
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("parses a JSON-string struct payload", () => {
    const json = JSON.stringify({ id: "u1", name: "Mary Watson", avatar: null });
    render(<ContributorIdentity data={json} />);
    expect(screen.getByText("Mary Watson")).toBeInTheDocument();
    expect(screen.getByText("MW")).toBeInTheDocument();
  });

  it("renders nothing when data is null", () => {
    const { container } = render(<ContributorIdentity data={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when data is undefined", () => {
    const { container } = render(<ContributorIdentity data={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for blank name", () => {
    const { container } = render(
      <ContributorIdentity data={{ id: "u1", name: "   ", avatar: null }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for malformed JSON", () => {
    const { container } = render(<ContributorIdentity data="{not-json" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for JSON that doesn't match the struct shape", () => {
    const { container } = render(<ContributorIdentity data={JSON.stringify({ name: "X" })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("derives initials from the first two parts for multi-word names", () => {
    render(
      <ContributorIdentity data={{ id: "u1", name: "Marie Sklodowska Curie", avatar: null }} />,
    );
    expect(screen.getByText("MC")).toBeInTheDocument();
  });

  it("uses the first two characters when the name is single-word", () => {
    render(<ContributorIdentity data={{ id: "u1", name: "Madonna", avatar: null }} />);
    expect(screen.getByText("MA")).toBeInTheDocument();
  });
});
