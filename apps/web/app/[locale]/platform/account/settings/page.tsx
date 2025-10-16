import { auth } from "@/lib/auth";
import { AccountSettings } from "~/components/account-settings/account-settings";

export default async function AccountSettingsPage() {
  const session = await auth();

  return (
    <div className="space-y-6">
      <AccountSettings session={session} />
    </div>
  );
}
