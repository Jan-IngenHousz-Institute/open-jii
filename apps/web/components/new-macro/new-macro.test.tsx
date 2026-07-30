import { createMacro, createUserProfile } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor, userEvent } from "@/test/test-utils";
import * as base64Utils from "@/util/base64";
import { beforeEach, describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

import { NewMacroForm } from "./new-macro";

// The real zod resolver runs here: the create body requires a name and non-empty code, and
// the starter template has to satisfy `code` on a submit that never touches the editor.
vi.mock("@/util/base64", () => ({
  encodeBase64: vi.fn((s: string) => Buffer.from(s).toString("base64")),
}));

vi.mock("../macro-code-editor", () => ({
  default: (props: {
    value: string;
    onChange: (value: string) => void;
    language?: string;
    title?: string;
  }) => (
    <div data-testid="code-editor" data-language={props.language}>
      {props.title != null && <div>{props.title}</div>}
      <textarea
        data-testid="code-editor-value"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  ),
}));

vi.mocked(useSession).mockReturnValue({
  data: { user: { id: "user-1" } },
  isPending: false,
} as ReturnType<typeof useSession>);

const findEditor = () => screen.findByTestId<HTMLTextAreaElement>("code-editor-value");

const fillName = async (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.type(screen.getByPlaceholderText("newMacro.name"), name);

/** The language select is the first combobox on the page; it carries no accessible name. */
const selectLanguage = async (user: ReturnType<typeof userEvent.setup>, next: string) => {
  const [languageTrigger] = screen.getAllByRole("combobox");
  await user.click(languageTrigger);
  await user.click(await screen.findByRole("option", { name: next }));
};

describe("NewMacroForm", () => {
  beforeEach(() => {
    // The form reads the current user and lists protocols to populate
    // the "compatible protocols" picker; mount default empty responses so
    // every test doesn't have to do it.
    server.mount(contract.users.getUserProfile, {
      body: createUserProfile({ firstName: "Ada", lastName: "Lovelace" }),
    });
    server.mount(contract.protocols.listProtocols, { body: [] });
  });

  it("renders form structure", async () => {
    render(<NewMacroForm />);

    expect(screen.getByPlaceholderText("newMacro.name")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("code-editor")).toBeInTheDocument();
    });
    expect(screen.getByText("newMacro.codeTitle")).toBeInTheDocument();
  });

  it("renders cancel and submit buttons", () => {
    render(<NewMacroForm />);
    expect(screen.getByText("newMacro.cancel")).toBeInTheDocument();
    expect(screen.getByText("newMacro.finalizeSetup")).toBeInTheDocument();
  });

  it("navigates back on cancel", async () => {
    const user = userEvent.setup();
    const { router } = render(<NewMacroForm />);
    await user.click(screen.getByText("newMacro.cancel"));
    expect(router.back).toHaveBeenCalled();
  });

  it("submits form (POST /api/v1/macros)", async () => {
    const spy = server.mount(contract.macros.createMacro, {
      body: createMacro({ id: "macro-42", name: "New Macro", code: "" }),
    });

    const user = userEvent.setup();
    const { router } = render(<NewMacroForm />);
    await fillName(user, "New Macro");
    await user.click(screen.getByText("newMacro.finalizeSetup"));

    await waitFor(() => {
      expect(spy.called).toBe(true);
    });
    expect(vi.mocked(base64Utils.encodeBase64)).toHaveBeenCalled();

    // onSuccess navigates to the new macro
    await waitFor(() => {
      expect(router.push).toHaveBeenCalled();
    });
  });

  it("renders code editor with default language", async () => {
    render(<NewMacroForm />);
    await waitFor(() => {
      expect(screen.getByTestId("code-editor")).toBeInTheDocument();
    });
    expect(screen.getByTestId("code-editor")).toHaveAttribute("data-language", "python");
  });

  it("seeds the editor with the language template as a real form value", async () => {
    const spy = server.mount(contract.macros.createMacro, {
      body: createMacro({ id: "macro-42" }),
    });

    const user = userEvent.setup();
    render(<NewMacroForm />);

    const editor = await findEditor();
    await waitFor(() => expect(editor.value).toContain("output = {}"));
    const displayed = editor.value;

    // Submit without touching the editor: the template the user saw is what passes
    // validation and gets sent.
    await fillName(user, "New Macro");
    await user.click(screen.getByText("newMacro.finalizeSetup"));

    await waitFor(() => {
      expect(spy.called).toBe(true);
    });
    const sent = Buffer.from((spy.body as { code: string }).code, "base64").toString();
    expect(sent).toBe(displayed);
    expect(sent).toContain("# Macro for data evaluation on openjii.org");
    expect(screen.queryByText(/Code file content is required/)).not.toBeInTheDocument();
  });

  it("names the signed-in user in the template header", async () => {
    render(<NewMacroForm />);

    const editor = await findEditor();
    await waitFor(() => expect(editor.value).toContain("# by: Ada Lovelace"));
  });

  it("follows the language while the code is untouched", async () => {
    const user = userEvent.setup();
    render(<NewMacroForm />);

    const editor = await findEditor();
    await waitFor(() => expect(editor.value).toContain("output = {}"));

    await selectLanguage(user, "R");

    await waitFor(() => expect(editor.value).toContain("output <- list()"));
  });

  it("does not clobber user edits when the language changes", async () => {
    const user = userEvent.setup();
    render(<NewMacroForm />);

    const editor = await findEditor();
    await waitFor(() => expect(editor.value).toContain("output = {}"));

    await user.clear(editor);
    await user.type(editor, "mine");
    expect(editor).toHaveValue("mine");

    await selectLanguage(user, "R");

    expect(screen.getByTestId("code-editor")).toHaveAttribute("data-language", "r");
    expect(editor).toHaveValue("mine");
  });
});
