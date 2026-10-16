import { Fragment } from "react";
import type { ReactNode } from "react";

export interface HomeSection {
  key: string;
  /** The main column holds what people open or act on, the rail what they glance at. */
  column: "main" | "rail";
  node: ReactNode;
}

/**
 * The home's sections as one ordered list, which is also the order they stack in below the
 * two-column width and the order a keyboard or screen reader meets them at any width. From
 * that width the main sections fill the left column and the rail sections the right one.
 * Rail sections listed before the first main section head the rail; any listed after it
 * follow the whole main column in one column, so list them after the main sections.
 *
 * The width is the home's own rather than the window's, so both columns still fit beside a
 * side panel.
 */
export function HomeLayout({ sections }: { sections: HomeSection[] }) {
  const firstMain = sections.findIndex((section) => section.column === "main");
  const lead = firstMain === -1 ? sections : sections.slice(0, firstMain);
  const rest = firstMain === -1 ? [] : sections.slice(firstMain);

  const renderSection = (section: HomeSection) => (
    <Fragment key={section.key}>{section.node}</Fragment>
  );

  // A group whose sections all render nothing is empty, and hiding it keeps its gap away.
  const groupClassName = "flex min-w-0 flex-col gap-8 empty:hidden";

  return (
    <div className="@container">
      <div className="@4xl:grid @4xl:grid-cols-[minmax(0,1fr)_20rem] @4xl:grid-rows-[auto_1fr] @4xl:items-start @4xl:gap-x-10 @4xl:gap-y-0 flex flex-col gap-8">
        <div className={`@4xl:col-[2] @4xl:row-[1] @4xl:mb-8 ${groupClassName}`}>
          {lead.map(renderSection)}
        </div>
        <div className={`@4xl:col-[1] @4xl:row-[1/3] ${groupClassName}`}>
          {rest.filter((section) => section.column === "main").map(renderSection)}
        </div>
        <div className={`@4xl:col-[2] @4xl:row-[2] ${groupClassName}`}>
          {rest.filter((section) => section.column === "rail").map(renderSection)}
        </div>
      </div>
    </div>
  );
}
