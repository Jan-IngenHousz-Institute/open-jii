import { fireEvent, render, screen } from "@/test/test-utils";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import type {
  ButtonFieldsFragment,
  FooterFieldsFragment,
  PageFaqFieldsFragment,
  PageTermsAndConditionsFieldsFragment,
} from "@repo/cms/lib/__generated/sdk";

import { ContentfulPreviewProvider } from "./contentful/ctf-preview-provider";
import { FaqContent } from "./faq";
import { HomeFooter } from "./footer";
import {
  TermsAndConditionsContent,
  TermsAndConditionsPage,
  TermsAndConditionsTitle,
} from "./terms-and-conditions";

function Preview({ children }: { children: ReactNode }) {
  return (
    <ContentfulPreviewProvider locale="en-US" enableInspectorMode enableLiveUpdates={false}>
      {children}
    </ContentfulPreviewProvider>
  );
}

function faq(ids: string[]): PageFaqFieldsFragment {
  return {
    __typename: "PageFaq",
    sys: { id: "faq", environmentId: "master" },
    title: "Questions",
    questionsCollection: {
      items: ids.map((id) => ({
        __typename: "ComponentFaqQuestion",
        sys: { id, environmentId: "master" },
        question: id,
      })),
    },
  };
}

function footer(ids: string[]): FooterFieldsFragment {
  const buttons: ButtonFieldsFragment[] = ids.map((id) => ({
    __typename: "ComponentButton",
    sys: { id, environmentId: "master" },
    label: id,
    url: `/${id}`,
  }));
  return {
    __typename: "Footer",
    sys: { id: "footer", environmentId: "master" },
    menuButtonsCollection: { items: buttons },
  };
}

describe("CMS preview rendering", () => {
  it("keeps question inspector IDs and interaction when the question count changes", () => {
    const view = (ids: string[]) => (
      <Preview>
        <FaqContent faq={faq(ids)} locale="en-US" preview={false} />
      </Preview>
    );
    const { rerender } = render(view(["first"]));
    rerender(view(["first", "second"]));

    const question = screen.getByRole("button", { name: "second" });
    expect(screen.getByText("second")).toHaveAttribute("data-contentful-entry-id", "second");
    fireEvent.click(question);
    expect(question).toHaveAttribute("aria-expanded", "true");

    rerender(view(["second"]));
    expect(screen.queryByRole("button", { name: "first" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "second" })).toBeInTheDocument();
  });

  it("keeps button inspector IDs and localized links when footer collections change", () => {
    const view = (ids: string[]) => (
      <Preview>
        <HomeFooter footerData={footer(ids)} locale="en-US" preview={false} />
      </Preview>
    );
    const { rerender } = render(view(["first"]));
    rerender(view(["first", "second"]));
    const link = screen.getByRole("link", { name: "second" });
    expect(link).toHaveAttribute("href", "/en-US/second");
    expect(link.closest("li")).toHaveAttribute("data-contentful-entry-id", "second");

    rerender(view([]));
    expect(screen.queryByRole("link", { name: "first" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "second" })).not.toBeInTheDocument();
  });

  it("renders terms through missing, present and missing data without changing hook order", () => {
    const terms: PageTermsAndConditionsFieldsFragment = {
      __typename: "PageTermsAndConditions",
      sys: { id: "terms", environmentId: "master" },
      title: "Research terms",
    };
    const view = (data: PageTermsAndConditionsFieldsFragment | null) => (
      <Preview>
        <TermsAndConditionsTitle termsAndConditions={data} locale="en-US" />
        <TermsAndConditionsContent termsAndConditions={data} locale="en-US" preview={false} />
        <TermsAndConditionsPage termsAndConditions={data} locale="en-US" preview={false} />
      </Preview>
    );
    const { rerender } = render(view(null));
    expect(screen.getByText("errors.termsContentUnavailable")).toBeInTheDocument();

    rerender(view(terms));
    expect(screen.getByRole("heading", { name: "Research terms" })).toHaveAttribute(
      "data-contentful-entry-id",
      "terms",
    );

    rerender(view(null));
    expect(screen.getByText("errors.termsContentUnavailable")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Research terms" })).not.toBeInTheDocument();
  });
});
