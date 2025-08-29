import { auth } from "@/lib/auth";
import { AccountSettings } from "~/components/account-settings/account-settings";

export default async function AccountSettingsPage() {
  const session = await auth();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Account Settings</h3>
        <p className="text-muted-foreground text-sm">
          Manage your account information and preferences
        </p>
      </div>
      <AccountSettings session={session} />
    </div>
  );
}
