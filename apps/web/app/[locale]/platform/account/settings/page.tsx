import { AccountSettings } from "@/features/account/components/account-settings";
import { auth } from "@/shared/api/auth";

export default async function AccountSettingsPage() {
  const session = await auth();

  return (
    <div className="space-y-6">
      <AccountSettings session={session} />
    </div>
  );
}
