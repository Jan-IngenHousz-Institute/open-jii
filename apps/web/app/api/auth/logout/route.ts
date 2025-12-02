import { handleLogout } from "~/app/actions/auth";

export async function GET() {
  await handleLogout({ redirectTo: `/?logout=true` });
}
