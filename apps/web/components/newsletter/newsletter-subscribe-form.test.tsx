import { render, screen, userEvent, waitFor, fireEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { NewsletterSubscribeForm } from "./newsletter-subscribe-form";

// The public subscribe mutation. `mutationOptions` forwards the onSuccess/onError
// the component passes so the real useMutation (from test-utils' QueryClient)
// drives the success/error state transitions.
const { mockSubscribe } = vi.hoisted(() => ({ mockSubscribe: vi.fn() }));

vi.mock("@/lib/orpc", () => ({
  orpc: {
    newsletter: {
      subscribe: {
        mutationOptions: (opts: Record<string, unknown>) => ({
          mutationFn: mockSubscribe,
          ...opts,
        }),
      },
    },
  },
}));

const VALID_EMAIL = "visitor@example.com";

describe("NewsletterSubscribeForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscribe.mockResolvedValue({ success: true });
  });

  it("renders the idle form with heading, email input and submit button", () => {
    render(<NewsletterSubscribeForm />);

    expect(screen.getByText("footer.title")).toBeInTheDocument();
    expect(screen.getByLabelText("footer.emailLabel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "footer.submit" })).toBeInTheDocument();
  });

  it("submits exactly { email } to the subscribe endpoint", async () => {
    const user = userEvent.setup();
    render(<NewsletterSubscribeForm />);

    await user.type(screen.getByLabelText("footer.emailLabel"), VALID_EMAIL);
    await user.click(screen.getByRole("button", { name: "footer.submit" }));

    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalledTimes(1);
    });
    // react-query passes a context object as the second arg; assert the payload only.
    expect(mockSubscribe.mock.calls[0]?.[0]).toEqual({ email: VALID_EMAIL });
  });

  it("shows the check-inbox success copy (never 'subscribed') in a polite live region", async () => {
    const user = userEvent.setup();
    render(<NewsletterSubscribeForm />);

    await user.type(screen.getByLabelText("footer.emailLabel"), VALID_EMAIL);
    await user.click(screen.getByRole("button", { name: "footer.submit" }));

    const status = await screen.findByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText("footer.successTitle")).toBeInTheDocument();
    expect(screen.getByText("footer.successMessage")).toBeInTheDocument();
    // Double opt-in: the form must never claim the address is already subscribed.
    expect(screen.queryByText(/subscribed/i)).not.toBeInTheDocument();
    // Form is replaced, so no submit button remains.
    expect(screen.queryByRole("button", { name: "footer.submit" })).not.toBeInTheDocument();
  });

  it("renders the same generic error for a 429 rate limit", async () => {
    mockSubscribe.mockRejectedValueOnce(
      Object.assign(new Error("Too Many Requests"), { status: 429 }),
    );
    const user = userEvent.setup();
    render(<NewsletterSubscribeForm />);

    await user.type(screen.getByLabelText("footer.emailLabel"), VALID_EMAIL);
    await user.click(screen.getByRole("button", { name: "footer.submit" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("footer.errorMessage");
    // Generic only: no rate-limit-specific copy leaks through.
    expect(screen.queryByText(/429|rate|limit/i)).not.toBeInTheDocument();
  });

  it("renders the same generic error for a network failure", async () => {
    mockSubscribe.mockRejectedValueOnce(new Error("Network down"));
    const user = userEvent.setup();
    render(<NewsletterSubscribeForm />);

    await user.type(screen.getByLabelText("footer.emailLabel"), VALID_EMAIL);
    await user.click(screen.getByRole("button", { name: "footer.submit" }));

    expect(await screen.findByText("footer.errorMessage")).toBeInTheDocument();
  });

  it("shows the translated invalid-email validation message as an alert and does not submit", async () => {
    render(<NewsletterSubscribeForm />);

    const input = screen.getByLabelText("footer.emailLabel");
    fireEvent.change(input, { target: { value: "not-an-email" } });
    // fireEvent.submit bypasses jsdom HTML5 email validation, matching repo convention.
    const form = input.closest("form");
    if (!form) throw new Error("form not found");
    fireEvent.submit(form);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("footer.invalidEmail");
    expect(mockSubscribe).not.toHaveBeenCalled();
  });

  it("trims surrounding whitespace on keyboard (Enter) submit", async () => {
    const user = userEvent.setup();
    render(<NewsletterSubscribeForm />);

    // Type padded value and submit with Enter (no blur); schema trim must apply.
    await user.type(screen.getByLabelText("footer.emailLabel"), `   ${VALID_EMAIL}   {Enter}`);

    await waitFor(() => {
      expect(mockSubscribe).toHaveBeenCalledTimes(1);
    });
    expect(mockSubscribe.mock.calls[0]?.[0]).toEqual({ email: VALID_EMAIL });
  });

  it("disables the input and button while the request is pending", async () => {
    // Never resolves, so the mutation stays pending.
    mockSubscribe.mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    render(<NewsletterSubscribeForm />);

    await user.type(screen.getByLabelText("footer.emailLabel"), VALID_EMAIL);
    await user.click(screen.getByRole("button", { name: "footer.submit" }));

    await waitFor(() => {
      expect(screen.getByLabelText("footer.emailLabel")).toBeDisabled();
    });
    expect(screen.getByRole("button", { name: "footer.submitting" })).toBeDisabled();
  });
});
