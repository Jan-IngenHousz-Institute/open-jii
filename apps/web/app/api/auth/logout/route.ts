import { handleLogout } from "~/app/actions/auth";

export async function GET() {
  return await handleLogout({ redirectTo: `/?logout=true` });
}
