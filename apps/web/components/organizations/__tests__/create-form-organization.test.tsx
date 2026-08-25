import { RegisterIotDeviceDialog } from "@/components/iot-devices/register-iot-device-dialog";
import { ListWorkbooks } from "@/components/list-workbooks";
import { NewExperimentForm } from "@/components/new-experiment/new-experiment";
import { NewMacroForm } from "@/components/new-macro/new-macro";
import { NewProtocolForm } from "@/components/new-protocol/new-protocol";
import {
  createMyOrganization,
  createProtocol,
  createUserProfile,
  createWorkbook,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { fireEvent, render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import { useSession } from "@repo/auth/client";

/**
 * One integration spec per create form, driving the real picker and asserting what
 * reaches the wire.
 *
 * These exist because the picker being wired to the form was not enough: the two
 * wizard-based forms dropped `organizationId` between the click and the request, and
 * every existing spec was blind to it — the experiment one replaces `WizardForm` with
 * a stub that hand-writes the payload, and the per-card specs render a card against a
 * bare `useForm` with no resolver at all. The loss happened in the resolver, which is
 * exactly the seam none of them crossed. So each assertion here is against the
 * outgoing request body, with nothing between the form and MSW stubbed out.
 */

const PERSONAL = createMyOrganization({
  id: "00000000-0000-0000-0000-0000000000a1",
  name: "Ada's workspace",
  isPersonal: true,
  role: "owner",
});
const LAB = createMyOrganization({
  id: "00000000-0000-0000-0000-0000000000b2",
  name: "Greenhouse Lab",
  isPersonal: false,
  role: "owner",
});

/** Choose the shared organization in whichever picker is on screen. */
async function pickTheLab(user: ReturnType<typeof userEvent.setup>) {
  const picker = await screen.findByRole("combobox", { name: "organizations.picker.label" });
  await user.click(picker);
  await user.click(await screen.findByRole("option", { name: LAB.name }));
}

/** Return the same picker to Personal, which is the contract's "no organization". */
async function pickPersonal(user: ReturnType<typeof userEvent.setup>) {
  const picker = await screen.findByRole("combobox", { name: "organizations.picker.label" });
  await user.click(picker);
  await user.click(await screen.findByRole("option", { name: "organizations.picker.personal" }));
}

describe("the owning organization a create form submits", () => {
  beforeEach(() => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1", email: "ada@example.com" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    server.mount(contract.organizations.listMyOrganizations, { body: [PERSONAL, LAB] });
    // The forms seed their code editor from the user profile once it loads; without a
    // handler the query burns through its retries and submit validation loses the race.
    server.mount(contract.users.getUserProfile, {
      body: createUserProfile({ firstName: "Ada", lastName: "Lovelace" }),
    });
    // The experiment wizard's linked-workbook step queries workbooks; keep it off the
    // unhandled-request path so a slow bypass can never bleed into the submit.
    server.mount(contract.workbooks.listWorkbooks, { body: [] });
  });

  describe("experiment", () => {
    /**
     * Four steps, driven for real. The wizard is deliberately *not* stubbed: its
     * resolver is where the value used to disappear.
     */
    async function submitWizard(user: ReturnType<typeof userEvent.setup>) {
      const nameInput = await screen.findByRole("textbox", { name: /newExperiment\.name/i });
      // fireEvent: the field is controlled by react-hook-form, so a per-character
      // userEvent.type fights the re-render.
      fireEvent.change(nameInput, { target: { value: "Photosynthesis Run" } });

      await pickTheLab(user);

      // Details → members/visibility → locations → review.
      for (let step = 0; step < 3; step++) {
        await user.click(screen.getByRole("button", { name: /experiments\.next/i }));
      }
      await user.click(
        await screen.findByRole("button", { name: /experiments\.(submit|create)/i }),
      );
    }

    it("submits the selected organization", async () => {
      const user = userEvent.setup();
      const createSpy = server.mount(contract.experiments.createExperiment, {
        body: { id: "00000000-0000-0000-0000-0000000000e1" },
      });

      render(<NewExperimentForm />);
      await submitWizard(user);

      await waitFor(() => {
        expect(createSpy.called).toBe(true);
      });
      expect(createSpy.body).toMatchObject({ organizationId: LAB.id });
    });

    it("submits no organization when the picker is left on Personal", async () => {
      const user = userEvent.setup();
      const createSpy = server.mount(contract.experiments.createExperiment, {
        body: { id: "00000000-0000-0000-0000-0000000000e1" },
      });

      render(<NewExperimentForm />);
      const nameInput = await screen.findByRole("textbox", { name: /newExperiment\.name/i });
      fireEvent.change(nameInput, { target: { value: "Photosynthesis Run" } });
      for (let step = 0; step < 3; step++) {
        await user.click(screen.getByRole("button", { name: /experiments\.next/i }));
      }
      await user.click(
        await screen.findByRole("button", { name: /experiments\.(submit|create)/i }),
      );

      await waitFor(() => {
        expect(createSpy.called).toBe(true);
      });
      // Omitted rather than sent as the personal id: the backend's own default is
      // the creator's personal workspace, and that is the behaviour being preserved.
      expect(createSpy.body).not.toHaveProperty("organizationId");
    });

    it("submits no organization after the picker is returned to Personal", async () => {
      const user = userEvent.setup();
      const createSpy = server.mount(contract.experiments.createExperiment, {
        body: { id: "00000000-0000-0000-0000-0000000000e1" },
      });

      render(<NewExperimentForm />);
      const nameInput = await screen.findByRole("textbox", { name: /newExperiment\.name/i });
      fireEvent.change(nameInput, { target: { value: "Photosynthesis Run" } });

      // Never changing the picker already passes; the failing path was choosing a
      // shared organization and then changing your mind back.
      await pickTheLab(user);
      await pickPersonal(user);

      for (let step = 0; step < 3; step++) {
        await user.click(screen.getByRole("button", { name: /experiments\.next/i }));
      }
      await user.click(
        await screen.findByRole("button", { name: /experiments\.(submit|create)/i }),
      );

      await waitFor(() => {
        expect(createSpy.called).toBe(true);
      });
      expect(createSpy.body).not.toHaveProperty("organizationId");
    });
  });

  describe("protocol", () => {
    it("submits the selected organization", async () => {
      const user = userEvent.setup();
      server.mount(contract.macros.listMacros, { body: [] });
      const createSpy = server.mount(contract.protocols.createProtocol, {
        body: createProtocol({ id: "00000000-0000-0000-0000-0000000000d1" }),
      });

      render(<NewProtocolForm />);

      const nameInput = await screen.findByRole("textbox", { name: /newProtocol\.name/i });
      fireEvent.change(nameInput, { target: { value: "SPAD" } });
      await pickTheLab(user);

      // Details → code/test → review: two advances, not one.
      await user.click(screen.getByRole("button", { name: /next/i }));
      // The code step is recognisable by the editor the global setup stubs in;
      // CodeMirror itself cannot run in jsdom.
      await waitFor(() => {
        expect(screen.getByTestId("code-editor")).toBeInTheDocument();
      });
      await user.click(screen.getByRole("button", { name: /next/i }));
      await waitFor(() => {
        expect(screen.getByText("newProtocol.reviewYourProtocol")).toBeInTheDocument();
      });
      await user.click(screen.getByRole("button", { name: /finalizeSetup/i }));

      await waitFor(() => {
        expect(createSpy.called).toBe(true);
      });
      expect(createSpy.body).toMatchObject({ organizationId: LAB.id });
    });
  });

  describe("macro", () => {
    it("submits the selected organization", async () => {
      const user = userEvent.setup();
      server.mount(contract.protocols.listProtocols, { body: [] });
      const createSpy = server.mount(contract.macros.createMacro, {
        body: { id: "00000000-0000-0000-0000-0000000000c1" },
      });

      render(<NewMacroForm />);

      const nameInput = await screen.findByPlaceholderText("newMacro.name");
      fireEvent.change(nameInput, { target: { value: "SPAD macro" } });
      await pickTheLab(user);

      await user.click(screen.getByRole("button", { name: /newMacro\.finalizeSetup/i }));

      await waitFor(() => {
        expect(createSpy.called).toBe(true);
      });
      expect(createSpy.body).toMatchObject({ organizationId: LAB.id });
    });
  });

  describe("workbook", () => {
    it("submits the selected organization", async () => {
      const user = userEvent.setup();
      server.mount(contract.workbooks.listWorkbooks, { body: [] });
      const createSpy = server.mount(contract.workbooks.createWorkbook, {
        body: createWorkbook({ id: "00000000-0000-0000-0000-0000000000b1" }),
      });

      render(<ListWorkbooks />);

      await user.click(screen.getByRole("button", { name: /workbooks\.create/i }));
      const dialog = within(await screen.findByRole("dialog"));
      fireEvent.change(dialog.getByPlaceholderText("workbooks.namePlaceholder"), {
        target: { value: "Field notes" },
      });
      await pickTheLab(user);
      await user.click(dialog.getByRole("button", { name: /workbooks\.create/i }));

      await waitFor(() => {
        expect(createSpy.called).toBe(true);
      });
      expect(createSpy.body).toMatchObject({ organizationId: LAB.id });
    });
  });

  describe("device", () => {
    it("submits the selected organization", async () => {
      const user = userEvent.setup();
      const registerSpy = server.mount(contract.iot.registerIotDevice, {
        body: { id: "00000000-0000-0000-0000-0000000000f1" },
      });

      render(<RegisterIotDeviceDialog open onOpenChange={vi.fn()} />);

      fireEvent.change(screen.getByPlaceholderText("iot.devices.dialog.serialPlaceholder"), {
        target: { value: "AA:BB:CC:DD:EE:FF" },
      });
      await user.click(screen.getByRole("combobox", { name: /typeLabel/i }));
      await user.click(screen.getAllByRole("option")[0]);
      await pickTheLab(user);

      await user.click(screen.getByRole("button", { name: /iot\.devices\.dialog\.submit/i }));

      await waitFor(() => {
        expect(registerSpy.called).toBe(true);
      });
      expect(registerSpy.body).toMatchObject({ organizationId: LAB.id });
    });
  });
});

/**
 * The review step is the last chance to notice the resource is about to land
 * somewhere unexpected, so the organization has to be one of the values it
 * summarizes — and it is the one row that is never blank, since leaving the picker
 * alone still means the personal workspace.
 */
describe("the owning organization a wizard review step shows", () => {
  beforeEach(() => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: "user-1", email: "ada@example.com" } },
      isPending: false,
    } as ReturnType<typeof useSession>);
    server.mount(contract.organizations.listMyOrganizations, { body: [PERSONAL, LAB] });
    // The review step renders the linked-workbook section, which queries workbooks.
    server.mount(contract.workbooks.listWorkbooks, { body: [] });
  });

  it("names the chosen organization on the experiment review", async () => {
    const user = userEvent.setup();
    render(<NewExperimentForm />);

    const nameInput = await screen.findByRole("textbox", { name: /newExperiment\.name/i });
    fireEvent.change(nameInput, { target: { value: "Photosynthesis Run" } });
    await pickTheLab(user);
    for (let step = 0; step < 3; step++) {
      await user.click(screen.getByRole("button", { name: /experiments\.next/i }));
    }

    expect(await screen.findByText(LAB.name)).toBeVisible();
  });

  it("says Personal on the experiment review when the picker was left alone", async () => {
    const user = userEvent.setup();
    render(<NewExperimentForm />);

    const nameInput = await screen.findByRole("textbox", { name: /newExperiment\.name/i });
    fireEvent.change(nameInput, { target: { value: "Photosynthesis Run" } });
    for (let step = 0; step < 3; step++) {
      await user.click(screen.getByRole("button", { name: /experiments\.next/i }));
    }

    // The generated workspace name is never shown: it is not a name anybody chose,
    // and the picker labelled the same choice "Personal".
    expect(await screen.findByText("organizations.picker.personal")).toBeVisible();
    expect(screen.queryByText(PERSONAL.name)).not.toBeInTheDocument();
  });

  it("names the chosen organization on the protocol review", async () => {
    const user = userEvent.setup();
    server.mount(contract.macros.listMacros, { body: [] });
    render(<NewProtocolForm />);

    const nameInput = await screen.findByRole("textbox", { name: /newProtocol\.name/i });
    fireEvent.change(nameInput, { target: { value: "SPAD" } });
    await pickTheLab(user);

    await user.click(screen.getByRole("button", { name: /next/i }));
    await waitFor(() => {
      expect(screen.getByTestId("code-editor")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(await screen.findByText("newProtocol.reviewYourProtocol")).toBeVisible();
    expect(screen.getByText(LAB.name)).toBeVisible();
  });
});
