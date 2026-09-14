import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { PageContainer } from "./page-container";

describe("PageContainer", () => {
  it.each(["fluid", "wide", "reading"] as const)(
    "lets %s pages shrink around intrinsically wide children",
    (width) => {
      render(
        <PageContainer width={width} data-testid="page-container">
          content
        </PageContainer>,
      );

      expect(screen.getByTestId("page-container")).toHaveClass("min-w-0");
    },
  );
});
