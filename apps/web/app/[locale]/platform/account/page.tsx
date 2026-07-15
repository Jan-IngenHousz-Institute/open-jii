import { auth } from "~/app/actions/auth";
import { AccountSettings } from "~/components/account-settings/account-settings";

export default async function AccountPage() {
  const session = await auth();

  return <AccountSettings session={session} />;
}
