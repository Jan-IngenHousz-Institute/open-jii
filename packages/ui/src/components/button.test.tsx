import { render, screen } from "@testing-library/react";
import React from "react";

import { Button } from "./button";

describe("Button", () => {
  it("renders a button with text", () => {
    render(<Button>Click me</Button>);

    const button = screen.getByRole("button", { name: /click me/i });
    expect(button).toBeDefined();
    expect(button.textContent).toBe("Click me");
  });

  it("applies default variant classes", () => {
    render(<Button>Default Button</Button>);

    const button = screen.getByRole("button");
    expect(button.className).toContain("bg-primary");
    expect(button.className).toContain("text-primary-foreground");
  });

  it("applies custom variant classes", () => {
    render(<Button variant="destructive">Delete</Button>);

    const button = screen.getByRole("button");
    expect(button.className).toContain("bg-destructive");
    expect(button.className).toContain("text-destructive-foreground");
  });

  it("applies size classes", () => {
    render(<Button size="sm">Small Button</Button>);

    const button = screen.getByRole("button");
    expect(button.className).toContain("h-8");
    expect(button.className).toContain("px-3");
    expect(button.className).toContain("text-xs");
  });

  it("applies custom className", () => {
    render(<Button className="custom-class">Custom Button</Button>);

    const button = screen.getByRole("button");
    expect(button.className).toContain("custom-class");
  });

  it("forwards props to button element", () => {
    render(<Button disabled>Disabled Button</Button>);

    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("applies outline variant classes", () => {
    render(<Button variant="outline">Outline Button</Button>);

    const button = screen.getByRole("button");
    expect(button.className).toContain("border");
    expect(button.className).toContain("border-input");
    expect(button.className).toContain("bg-background");
  });

  it("applies ghost variant classes", () => {
    render(<Button variant="ghost">Ghost Button</Button>);

    const button = screen.getByRole("button");
    expect(button.className).toContain("hover:bg-surface");
    expect(button.className).toContain("hover:text-accent-foreground");
  });

  it("applies large size classes", () => {
    render(<Button size="lg">Large Button</Button>);

    const button = screen.getByRole("button");
    expect(button.className).toContain("h-10");
    expect(button.className).toContain("px-8");
  });

  it("applies icon size classes", () => {
    render(<Button size="icon">🔥</Button>);

    const button = screen.getByRole("button");
    expect(button.className).toContain("h-9");
    expect(button.className).toContain("w-9");
  });

  it("shows loading spinner when isLoading is true", () => {
    const { container } = render(<Button isLoading>Click me</Button>);
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeTruthy();
    const button = screen.getByRole("button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("does not show loading spinner when asChild is true", () => {
    const { container } = render(
      <Button asChild isLoading>
        <span>Click me</span>
      </Button>,
    );
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeNull();
  });
});
