import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../dialog";

function renderDialog(body: React.ReactNode) {
  return render(
    <Dialog open>
      <DialogContent>
        <DialogHeader data-testid="header">
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Description</DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter data-testid="footer">Actions</DialogFooter>
      </DialogContent>
    </Dialog>,
  );
}

describe("Dialog", () => {
  it("caps the content at the viewport and scrolls it as a last resort", () => {
    renderDialog(<p>Body</p>);

    expect(screen.getByRole("dialog")).toHaveClass(
      "max-h-[calc(100dvh-2rem)]",
      "flex",
      "flex-col",
      "overflow-y-auto",
    );
  });

  it("scrolls the body between a pinned header and footer", () => {
    renderDialog(<DialogBody data-testid="body">Long content</DialogBody>);

    expect(screen.getByTestId("body")).toHaveClass("min-h-0", "flex-1", "overflow-y-auto");
    expect(screen.getByTestId("body")).toHaveTextContent("Long content");
    expect(screen.getByTestId("header")).toHaveClass("shrink-0");
    expect(screen.getByTestId("footer")).toHaveClass("shrink-0");
  });

  it("lets a body with its own padding drop the focus-ring inset", () => {
    renderDialog(
      <DialogBody data-testid="body" className="m-0 px-6 py-5">
        Content
      </DialogBody>,
    );

    const body = screen.getByTestId("body");
    expect(body).toHaveClass("m-0", "px-6", "py-5");
    expect(body).not.toHaveClass("-m-1", "p-1");
  });
});
