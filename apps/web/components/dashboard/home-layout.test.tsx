import { render } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { HomeLayout } from "./home-layout";
import type { HomeSection } from "./home-layout";

describe("HomeLayout", () => {
  const sections: HomeSection[] = [
    { key: "notifications", column: "rail", node: <p>Notifications</p> },
    { key: "recent", column: "main", node: <p>Recent</p> },
    { key: "public", column: "main", node: <p>Public</p> },
    { key: "activity", column: "rail", node: <p>Activity</p> },
  ];

  const groupsOf = (container: HTMLElement) =>
    Array.from(container.firstElementChild?.firstElementChild?.children ?? []);

  it("keeps the list's order in the document, which is the one-column order", () => {
    const { container } = render(<HomeLayout sections={sections} />);

    expect(container).toHaveTextContent("NotificationsRecentPublicActivity");
  });

  it("heads the rail with the rail sections listed before the first main one", () => {
    const { container } = render(<HomeLayout sections={sections} />);

    const [lead, main, rail] = groupsOf(container);
    expect(lead).toHaveTextContent("Notifications");
    expect(main).toHaveTextContent("RecentPublic");
    expect(rail).toHaveTextContent("Activity");
  });

  it("leaves a group empty when its sections render nothing", () => {
    const Nothing = () => null;
    const { container } = render(
      <HomeLayout
        sections={[
          { key: "notifications", column: "rail", node: <Nothing /> },
          { key: "recent", column: "main", node: <p>Recent</p> },
        ]}
      />,
    );

    const [lead] = groupsOf(container);
    expect(lead).toBeEmptyDOMElement();
  });
});
