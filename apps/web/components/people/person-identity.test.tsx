import { render, screen } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSession } from "@repo/auth/client";

import { PersonIdentity } from "./person-identity";

function mockSession(user: { id: string } | null) {
  vi.mocked(useSession).mockReturnValue({
    data: user ? { user } : null,
    isPending: false,
  } as ReturnType<typeof useSession>);
}

describe("<PersonIdentity />", () => {
  afterEach(() => mockSession(null));

  it("marks the signed-in person, and nobody else", () => {
    mockSession({ id: "u-me" });
    const { rerender } = render(
      <PersonIdentity person={{ id: "u-me", firstName: "Ada", lastName: "Byron" }} />,
    );
    expect(screen.getByText("sharing.you")).toBeInTheDocument();

    rerender(<PersonIdentity person={{ id: "u-2", firstName: "Lin", lastName: "Zhao" }} />);
    expect(screen.queryByText("sharing.you")).not.toBeInTheDocument();
  });

  it("leaves the marker off where the surface opts out", () => {
    mockSession({ id: "u-me" });
    render(<PersonIdentity person={{ id: "u-me", firstName: "Ada" }} showYou={false} />);

    expect(screen.queryByText("sharing.you")).not.toBeInTheDocument();
  });

  it("names the person by the rule, with initials from that name", () => {
    render(<PersonIdentity person={{ id: "u-1", displayName: "Contributor-7F3A2C" }} />);

    expect(screen.getByText("Contributor-7F3A2C")).toBeInTheDocument();
    expect(screen.getByText("C")).toBeInTheDocument();
  });

  it("leaves the avatar blank and shows the email once for a person with no name of their own", () => {
    const { container, rerender } = render(<PersonIdentity person={{ id: "u-1", email: null }} />);
    const avatar = () => container.querySelector(".rounded-full");

    expect(screen.getByText("common.unnamedAccount")).toBeInTheDocument();
    expect(avatar()).toHaveTextContent(/^$/u);

    rerender(<PersonIdentity person={{ id: "u-1", email: "lin@uni.edu" }} />);
    expect(screen.getAllByText("lin@uni.edu")).toHaveLength(1);
    expect(avatar()).toHaveTextContent(/^$/u);
  });

  it("puts badges on the name line, and further lines under the identity line", () => {
    render(
      <PersonIdentity
        person={{ id: "u-1", firstName: "Lin", lastName: "Zhao", email: "lin@uni.edu" }}
        badges={<span>Org member</span>}
      >
        <span>Reason</span>
      </PersonIdentity>,
    );

    const nameLine = screen.getByText("Lin Zhao").parentElement?.parentElement;
    expect(nameLine).toContainElement(screen.getByText("Org member"));
    expect(nameLine).not.toContainElement(screen.getByText("lin@uni.edu"));
    expect(nameLine).not.toContainElement(screen.getByText("Reason"));
  });

  it("gives a truncated name and email their full text on hover", () => {
    render(
      <PersonIdentity
        person={{
          id: "u-1",
          firstName: "Maximiliane",
          lastName: "Konstantinopoulou",
          email: "max@uni.edu",
        }}
      />,
    );

    expect(screen.getByText("Maximiliane Konstantinopoulou")).toHaveAttribute(
      "title",
      "Maximiliane Konstantinopoulou",
    );
    expect(screen.getByText("max@uni.edu")).toHaveAttribute("title", "max@uni.edu");
  });

  it("shows the email as the identity line, an override instead, or no line at all", () => {
    const person = { id: "u-1", firstName: "Lin", lastName: "Zhao", email: "lin@uni.edu" };
    const { rerender, container } = render(<PersonIdentity person={person} />);
    expect(screen.getByText("lin@uni.edu")).toBeInTheDocument();

    rerender(<PersonIdentity person={person} identityLine="common.emailMatched" />);
    expect(screen.getByText("common.emailMatched")).toBeInTheDocument();
    expect(screen.queryByText("lin@uni.edu")).not.toBeInTheDocument();

    rerender(<PersonIdentity person={{ ...person, email: null }} />);
    expect(container.querySelectorAll(".text-xs")).toHaveLength(0);
  });
});
